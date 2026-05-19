import { FilterKind, FilterSection, DashboardStatsSnapshot } from '../../models/dashboard-home.models';
import { DashboardMetric } from '../../models/dashboard-metric.model';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { CommonModule } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';

import { MatTooltipModule } from '@angular/material/tooltip';

import { forkJoin, Observable, of } from 'rxjs';

import { catchError, finalize, map } from 'rxjs/operators';

import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';





import { User } from '../../../../core/models';

import { AuthService } from '../../../../core/services/auth';

import { BusinessUnitsApiService } from '../../../../core/services/business-units-api.service';

import { DepartmentsApiService } from '../../../../core/services/departments-api.service';

import { PlantsApiService } from '../../../../core/services/plants-api.service';

import { ProjectService } from '../../../projects/services/project';

import { DashboardFilterParams, DashboardGroupedDistributionDto } from '../../../projects/models';

import {

  DashboardFilterService,

  DashboardFilterState,

  FilterTicket,

} from '../../services/dashboard-filter.service';




@Component({

  selector: 'app-dashboard-home',

  standalone: true,

  imports: [CommonModule, MatIconModule, MatTooltipModule, LoadingSpinner],

  templateUrl: './dashboard-home.html',

  styleUrls: ['./dashboard-home.scss', './dashboard-home-flat.scss'],
})

export class DashboardHome implements OnInit {

  private readonly authService = inject(AuthService);

  private readonly businessUnitsApi = inject(BusinessUnitsApiService);

  private readonly departmentsApi = inject(DepartmentsApiService);

  private readonly plantsApi = inject(PlantsApiService);

  private readonly projectService = inject(ProjectService);

  private readonly filterService = inject(DashboardFilterService);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);



  readonly user: User | null = this.authService.getCurrentUser();

  readonly currentYear = new Date().getFullYear();

  readonly currentMonth = new Date().getMonth() + 1;



  filterState: DashboardFilterState = this.filterService.defaultFilterState();



  isLoading = true;

  isRefreshing = false;

  hasLoadedDashboard = false;

  errorMessage = '';



  totalProjects = 0;

  averageOtd = 0;

  averageEffectiveness = 0;

  aboveTargetCount = 0;

  belowTargetCount = 0;

  delayedProjects = 0;



  businessUnitTickets: FilterTicket[] = [];

  departmentTickets: FilterTicket[] = [];

  plantTickets: FilterTicket[] = [];

  projectManagementTickets: FilterTicket[] = [];

  phaseTickets: FilterTicket[] = [];

  statusTickets: FilterTicket[] = [];

  projects: any[] = [];



  /**

   * The currently active ticket for drill-down view.

   * If null, we show the general project list from the latest paged query.

   */

  activeDrillDownTicket: FilterTicket | null = null;

  activeDrillDownSection: FilterSection | null = null;





  private readonly departmentIdByName = new Map<string, string>();

  private readonly businessUnitIdByName = new Map<string, string>();

  private readonly plantIdByName = new Map<string, string>();



  get hasActiveFilters(): boolean {

    return this.filterService.hasAnyFilterSelected(this.filterState);

  }



  get canRestoreFilters(): boolean {

    const defaultState = this.filterService.defaultFilterState();



    return Object.keys(defaultState).some((key) => {

      const filterKey = key as keyof DashboardFilterState;

      return this.filterState[filterKey] !== defaultState[filterKey];

    });

  }



  get periodLabel(): string {

    if (this.filterState.selectedStartDate && this.filterState.selectedEndDate) {

      return `${this.formatDateLabel(this.filterState.selectedStartDate)} - ${this.formatDateLabel(this.filterState.selectedEndDate)}`;

    }



    if (this.filterState.selectedStartDate) {

      return `From ${this.formatDateLabel(this.filterState.selectedStartDate)}`;

    }



    if (this.filterState.selectedEndDate) {

      return `Until ${this.formatDateLabel(this.filterState.selectedEndDate)}`;

    }



    return 'All dates';

  }



  get metrics(): DashboardMetric[] {

    return [

      {

        label: 'Projects',

        value: `${this.totalProjects}`,

        note: 'Projects matching the active filters',

        icon: 'inventory_2',

        tone: 'blue',

      },

      {

        label: 'OTD',

        value: `${this.formatPercent(this.averageOtd)}`,

        note: 'On-time delivery for the selected scope',

        icon: 'verified',

        tone: this.averageOtd >= 90 ? 'green' : 'orange',

      },

      {

        label: 'Effectiveness',

        value: `${this.formatPercent(this.averageEffectiveness)}`,

        note: 'Execution effectiveness for the selected scope',

        icon: 'auto_graph',

        tone: this.averageEffectiveness >= 90 ? 'green' : 'orange',

      },

      {

        label: 'Delayed',

        value: `${this.delayedProjects}`,

        note: 'Projects requiring attention',

        icon: 'timer_off',

        tone: this.delayedProjects > 0 ? 'red' : 'green',

      },

    ];

  }



  getToneColor(tone: string): string {

    switch (tone) {

      case 'green': return '#10b981';

      case 'orange': return '#f59e0b';

      case 'red': return '#ef4444';

      case 'blue': return '#3b82f6';

      default: return '#64748b';

    }

  }



  get filterSections(): FilterSection[] {

    return [

      {

        kind: 'projectManagement',

        title: 'Project Management',

        icon: 'manage_accounts',

        tickets: this.projectManagementTickets.filter((ticket) => ticket.id !== 'all'),

        selectedId: this.filterState.selectedProjectManagementType,

      },

      {

        kind: 'status',

        title: 'Project Status',

        icon: 'radio_button_checked',

        tickets: this.statusTickets.filter((ticket) => ticket.id !== 'all'),

        selectedId: this.filterState.selectedProjectStatus,

      },

      {

        kind: 'phase',

        title: 'Project Phases',

        icon: 'layers',

        tickets: this.phaseTickets.filter((ticket) => ticket.id !== 'all'),

        selectedId: this.filterState.selectedProjectPhase,

      },

      {

        kind: 'businessUnit',

        title: 'Business Units',

        icon: 'corporate_fare',

        tickets: this.businessUnitTickets,

        selectedId: this.filterState.selectedBusinessUnit,

      },

      {

        kind: 'department',

        title: 'Departments',

        icon: 'business',

        tickets: this.departmentTickets,

        selectedId: this.filterState.selectedDepartment,

      },

      {

        kind: 'plant',

        title: 'Plants',

        icon: 'factory',

        tickets: this.plantTickets,

        selectedId: this.filterState.selectedPlant,

      },

    ];

  }



  ngOnInit(): void {

    this.loadReferenceData();

  }



  selectFilterCard(kind: FilterKind, id: string): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    const nextId = this.getSelectedId(kind) === id ? 'all' : id;



    switch (kind) {

      case 'businessUnit':

        this.filterState.selectedBusinessUnit = nextId;

        break;

      case 'department':

        this.filterState.selectedDepartment = nextId;

        break;

      case 'plant':

        this.filterState.selectedPlant = nextId;

        break;

      case 'projectManagement':

        this.filterState.selectedProjectManagementType = nextId;

        break;

      case 'phase':

        this.filterState.selectedProjectPhase = nextId;

        break;

      case 'status':

        this.filterState.selectedProjectStatus = nextId;

        break;

    }



    this.loadDashboard();

  }



    clearAllFilters(): void {
    if (this.isLoading || this.isRefreshing) {
      return;
    }

    this.filterState = this.filterService.defaultFilterState();
    this.loadDashboard();
  }

  navigateToProjectsWithFilters(): void {
    const queryParams: any = {};

    if (this.filterState.selectedBusinessUnit !== 'all') {
      queryParams.BusinessUnitId = this.filterState.selectedBusinessUnit;
    }
    if (this.filterState.selectedDepartment !== 'all') {
      queryParams.DepartmentId = this.filterState.selectedDepartment;
    }
    if (this.filterState.selectedPlant !== 'all') {
      queryParams.PlantId = this.filterState.selectedPlant;
    }
    if (this.filterState.selectedProjectManagementType !== 'all') {
      queryParams.ProjectManagementType = this.filterState.selectedProjectManagementType;
    }
    if (this.filterState.selectedProjectPhase !== 'all') {
      queryParams.Phase = this.projectPhaseIdToNumber(this.filterState.selectedProjectPhase);
    }
    if (this.filterState.selectedProjectStatus !== 'all') {
      queryParams.Status = this.filterState.selectedProjectStatus;
    }
    if (this.filterState.selectedStartDate) {
      queryParams.startDate = this.filterState.selectedStartDate;
    }
    if (this.filterState.selectedEndDate) {
      queryParams.endDate = this.filterState.selectedEndDate;
    }
    if (this.filterState.selectedYear) {
      queryParams.year = this.filterState.selectedYear;
    }
    if (this.filterState.selectedMonth) {
      queryParams.month = this.filterState.selectedMonth;
    }

    void this.router.navigate(['/projects'], { queryParams });
  }

  sectionHasActiveFilter(section: FilterSection): boolean {
    return section.selectedId !== 'all';
  }

  resetSectionFilter(kind: FilterKind): void {
    if (this.isLoading || this.isRefreshing) {
      return;
    }

    switch (kind) {
      case 'businessUnit':
        this.filterState.selectedBusinessUnit = 'all';
        break;
      case 'department':
        this.filterState.selectedDepartment = 'all';
        break;
      case 'plant':
        this.filterState.selectedPlant = 'all';
        break;
      case 'projectManagement':
        this.filterState.selectedProjectManagementType = 'all';
        break;
      case 'phase':
        this.filterState.selectedProjectPhase = 'all';
        break;
      case 'status':
        this.filterState.selectedProjectStatus = 'all';
        break;
    }

    this.loadDashboard();
  }



  toggleDrillDown(section: FilterSection, ticket: FilterTicket): void {

    if (this.activeDrillDownTicket?.id === ticket.id && this.activeDrillDownSection?.kind === section.kind) {

      this.activeDrillDownTicket = null;

      this.activeDrillDownSection = null;

    } else {

      this.activeDrillDownTicket = ticket;

      this.activeDrillDownSection = section;

    }

    this.cdr.markForCheck();

  }



  get projectsToDisplay(): any[] {

    if (this.activeDrillDownTicket?.projects) {

      return this.activeDrillDownTicket.projects;

    }

    return this.projects;

  }



  selectCurrentMonth(): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    this.filterState.selectedYear = this.currentYear;

    this.filterState.selectedMonth = this.currentMonth;

    this.filterState.selectedStartDate = this.toDateInputValue(new Date(this.currentYear, this.currentMonth - 1, 1));

    this.filterState.selectedEndDate = this.toDateInputValue(new Date(this.currentYear, this.currentMonth, 0));

    this.loadDashboard();

  }



  selectAllDates(): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    this.filterState.selectedYear = null;

    this.filterState.selectedMonth = null;

    this.filterState.selectedStartDate = null;

    this.filterState.selectedEndDate = null;

    this.loadDashboard();

  }



  updateDateFilter(kind: 'start' | 'end', event: Event): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    const input = event.target as HTMLInputElement;

    const value = input.value || null;



    if (kind === 'start') {

      this.filterState.selectedStartDate = value;

    } else {

      this.filterState.selectedEndDate = value;

    }



    this.syncCalendarPeriod();

    this.loadDashboard();

  }



  trackByTicketId(_: number, ticket: FilterTicket): string {

    return ticket.id;

  }



  trackByProjectId(_: number, project: any): string {

    return project.id;

  }



  getTicketIcon(kind: FilterKind, ticket: FilterTicket): string {

    const label = ticket.label.trim().toLowerCase();



    if (kind === 'businessUnit') {

      if (label.includes('digital') || label.includes('innovation')) return 'tips_and_updates';

      if (label.includes('informatique') || label.includes('it') || label.includes('system')) return 'dns';

      if (label.includes('marketing')) return 'campaign';

      if (label.includes('manufacturing') || label.includes('production')) return 'precision_manufacturing';

      if (label.includes('finance')) return 'account_balance';

      if (label.includes('quality')) return 'verified';

      if (label.includes('supply') || label.includes('logistic')) return 'local_shipping';

      if (label.includes('hr') || label.includes('human')) return 'groups';

      return 'domain';

    }



    if (kind === 'department') {

      if (label.includes('informatique') || label.includes('it')) return 'computer';

      if (label.includes('finance')) return 'payments';

      if (label.includes('marketing')) return 'campaign';

      if (label.includes('engineering') || label.includes('technique')) return 'engineering';

      if (label.includes('manufacturing') || label.includes('production')) return 'factory';

      if (label.includes('quality')) return 'workspace_premium';

      if (label.includes('maintenance')) return 'handyman';

      if (label.includes('purchase') || label.includes('achat')) return 'shopping_cart';

      if (label.includes('logistic') || label.includes('supply')) return 'inventory_2';

      return 'account_tree';

    }



    if (kind === 'plant') {

      if (label.includes('plant') || label.includes('site')) return 'factory';

      if (label.includes('office') || label.includes('hq')) return 'business';

      if (label.includes('warehouse')) return 'warehouse';

      return 'location_on';

    }



    if (kind === 'projectManagement') {

      if (label.includes('digital operation')) return 'settings_suggest';

      if (label.includes('digital solution')) return 'hub';

      if (label.includes('infrastructure')) return 'lan';

      if (label.includes('process')) return 'schema';

      if (label.includes('other')) return 'more_horiz';

      return 'engineering';

    }



    if (kind === 'phase') {

      if (label.includes('pipeline')) return 'filter_alt';

      if (label.includes('pre')) return 'manage_search';

      if (label.includes('initiation')) return 'rocket_launch';

      if (label.includes('plan')) return 'event_note';

      if (label.includes('execution')) return 'play_circle';

      if (label.includes('monitor')) return 'monitoring';

      if (label.includes('closing')) return 'task_alt';

      return 'timeline';

    }



    if (kind === 'status') {

      if (label.includes('ongoing')) return 'autorenew';

      if (label.includes('hold')) return 'pause_circle';

      if (label.includes('done') || label.includes('complete')) return 'check_circle';

      if (label.includes('planned')) return 'calendar_month';

      return 'flag';

    }



    return 'label';

  }



  private loadReferenceData(): void {

    this.isLoading = true;

    this.errorMessage = '';



    forkJoin({

      departments: this.departmentsApi.listDepartments().pipe(catchError(() => of([]))),

      businessUnits: this.businessUnitsApi.listItems().pipe(catchError(() => of([]))),

      plants: this.plantsApi.listItems().pipe(catchError(() => of([]))),

    }).subscribe({

      next: ({ departments, businessUnits, plants }) => {

        this.departmentIdByName.clear();

        departments.forEach((department: any) => this.departmentIdByName.set(department.name.trim(), department.id));



        this.businessUnitIdByName.clear();

        businessUnits.forEach((businessUnit: any) =>

          this.businessUnitIdByName.set(businessUnit.name.trim(), businessUnit.id)

        );



        this.plantIdByName.clear();

        plants.forEach((plant: any) => this.plantIdByName.set(plant.name.trim(), plant.id));



        this.loadDashboard();

      },

      error: () => {

        this.isLoading = false;

        this.errorMessage = 'Unable to load dashboard filters.';

        this.cdr.markForCheck();

      },

    });

  }



  private loadDashboard(): void {

    const isInitialLoad = !this.hasLoadedDashboard;

    this.isLoading = isInitialLoad;

    this.isRefreshing = !isInitialLoad;

    this.errorMessage = '';



    const dashboardParams = this.filterService.buildParams(this.filterState);

    const projectParams = this.buildProjectParams(dashboardParams);

    forkJoin({

      projectsPage: this.projectService.getProjectsPaged(projectParams).pipe(catchError(() => of(null))),

      dashboard: this.loadDashboardSummary(dashboardParams).pipe(catchError(() => of(null))),

      dashboardBi: this.loadDashboardBi(dashboardParams).pipe(catchError(() => of(null))),

      groupedDistribution: this.user?.isAdmin 

        ? this.projectService.getAdminDashboardGroupedDistribution(dashboardParams).pipe(catchError(() => of(null)))

        : of(null),

    })

      .pipe(

        finalize(() => {

          this.isRefreshing = false;

          this.cdr.markForCheck();

        })

      )

      .subscribe(({ projectsPage, dashboard, dashboardBi, groupedDistribution }) => {

        this.projects = projectsPage?.data ?? [];

        this.totalProjects = projectsPage?.totalCount ?? this.projects.length;

        this.rebuildFilterTickets(this.projects);

        

        // Reset drill-down if the ticket is no longer available or counts changed

        this.activeDrillDownTicket = null;

        this.activeDrillDownSection = null;



        if (!dashboard) {

          this.errorMessage = 'Unable to load dashboard stats right now.';

          this.isLoading = false;

          return;

        }



        const stats = this.extractDashboardStats(dashboard.raw ?? dashboard, this.totalProjects);

        this.totalProjects = stats.totalProjects;

        this.averageOtd = stats.averageOtd;

        this.averageEffectiveness = stats.averageEffectiveness;

        this.delayedProjects = stats.delayedProjects;

        this.aboveTargetCount = stats.aboveTargetCount;

        this.belowTargetCount = stats.belowTargetCount;



        // Apply counts from BI/Extended if available

        this.syncTicketCountsFromDashboard(dashboard.raw ?? dashboard);

        if (dashboardBi) {

          this.syncTicketCountsFromDashboard(dashboardBi.raw ?? dashboardBi);

        }



        // Override/supplement with high-precision counts from the new grouped distribution endpoint

        if (groupedDistribution) {

          this.syncTicketCountsFromGroupedDistribution(groupedDistribution);

        }



        this.hasLoadedDashboard = true;

        this.isLoading = false;

      });

  }



  private loadDashboardSummary(params: DashboardFilterParams) {

    if (this.user?.isAdmin) {

      return this.projectService.getAdminDashboardExtended(params).pipe(

        map((dashboard: any) => ({

          summary: dashboard?.summary ?? {},

          raw: dashboard,

        }))

      );

    }



    return this.projectService.getUserDashboardOverview(params).pipe(

      map((dashboard: any) => ({

        summary: dashboard?.summary ?? {},

        raw: dashboard,

      }))

    );

  }



  private loadDashboardBi(params: DashboardFilterParams): Observable<{ raw: any } | null> {

    if (!this.user?.isAdmin) {

      return of(null);

    }



    return this.projectService.getAdminDashboardBi(params).pipe(

      map((dashboard: any) => ({

        raw: dashboard,

      }))

    );

  }



  private extractDashboardStats(rawDashboard: any, projectCountFallback: number): DashboardStatsSnapshot {

    const summary = rawDashboard?.summary ?? rawDashboard ?? {};

    const health = rawDashboard?.portfolioHealth ?? rawDashboard?.health ?? {};

    const kpis = rawDashboard?.kpis ?? {};

    const charts = rawDashboard?.charts ?? {};

    const deliveryMetrics = this.asLabelValueArray(charts.deliveryMetrics ?? health.deliveryMetrics ?? kpis.deliveryMetrics);



    const otdFromDelivery = this.findMetricValue(deliveryMetrics, ['otd', 'on time delivery', 'on-time delivery']);

    const effectivenessFromDelivery = this.findMetricValue(deliveryMetrics, ['effectiveness', 'efficiency']);



    return {

      totalProjects: this.firstNumber(

        [

          summary.totalProjects,

          summary.TotalProjects,

          health.totalProjects,

          health.TotalProjects,

          kpis.totalProjects,

          kpis.TotalProjects,

          projectCountFallback,

        ],

        projectCountFallback

      ),

      averageOtd: this.firstNumber(

        [

          summary.averageOtd,

          summary.averageOTD,

          summary.AverageOtd,

          summary.AverageOTD,

          health.averageOtd,

          health.averageOTD,

          health.AverageOtd,

          health.AverageOTD,

          kpis.averageOtd,

          kpis.averageOTD,

          kpis.otd,

          otdFromDelivery,

        ],

        0

      ),

      averageEffectiveness: this.firstNumber(

        [

          summary.averageEffectiveness,

          summary.AverageEffectiveness,

          summary.effectiveness,

          health.averageEffectiveness,

          health.AverageEffectiveness,

          health.effectiveness,

          kpis.averageEffectiveness,

          kpis.effectiveness,

          effectivenessFromDelivery,

        ],

        0

      ),

      delayedProjects: this.firstNumber(

        [

          summary.delayedProjects,

          summary.DelayedProjects,

          health.delayedProjects,

          health.DelayedProjects,

          rawDashboard?.risks?.delayedProjects,

        ],

        0

      ),

      aboveTargetCount: this.firstNumber(

        [

          summary.doneProjectsAboveTarget,

          summary.DoneProjectsAboveTarget,

          summary.projectsAboveTarget,

          health.doneProjectsAboveTarget,

          kpis.doneProjectsAboveTarget,

        ],

        0

      ),

      belowTargetCount: this.firstNumber(

        [

          summary.doneProjectsBelowTarget,

          summary.DoneProjectsBelowTarget,

          summary.projectsBelowTarget,

          health.doneProjectsBelowTarget,

          kpis.doneProjectsBelowTarget,

        ],

        0

      ),

    };

  }



  private asLabelValueArray(source: unknown): Array<{ label: string; value: number }> {

    if (Array.isArray(source)) {

      return source

        .map((item) => {

          const row = item as Record<string, unknown>;

          return {

            label: String(row['label'] ?? row['name'] ?? row['key'] ?? '').trim(),

            value: Number(row['value'] ?? row['count'] ?? 0),

          };

        })

        .filter((item) => item.label && Number.isFinite(item.value));

    }



    if (source && typeof source === 'object') {

      return Object.entries(source as Record<string, unknown>).map(([label, value]) => ({

        label,

        value: Number(value ?? 0),

      }));

    }



    return [];

  }



  private findMetricValue(metrics: Array<{ label: string; value: number }>, labels: string[]): number | undefined {

    const normalizedLabels = labels.map((label) => label.toLowerCase());

    const found = metrics.find((metric) => normalizedLabels.includes(metric.label.trim().toLowerCase()));

    return found?.value;

  }



  private firstNumber(values: unknown[], fallback: number): number {

    for (const value of values) {

      const parsed = Number(value);

      if (Number.isFinite(parsed)) {

        return parsed;

      }

    }



    return fallback;

  }



  private syncTicketCountsFromDashboard(rawDashboard: any): void {

    const charts = rawDashboard?.charts ?? rawDashboard?.portfolioHealth ?? {};



    this.syncTicketCounts(this.businessUnitTickets, this.firstChart(charts, [

      'projectsByBusinessUnit',

      'projectsByBU',

      'businessUnitProjects',

      'projectsByBusinessUnits',

    ]));

    this.syncTicketCounts(this.departmentTickets, this.firstChart(charts, [

      'projectsByDepartment',

      'departmentProjects',

      'projectsByDepartments',

    ]));

    this.syncTicketCounts(this.plantTickets, this.firstChart(charts, [

      'projectsByPlant',

      'plantProjects',

      'projectsByPlants',

    ]));

    this.syncTicketCounts(this.statusTickets, this.firstChart(charts, [

      'projectsByStatus',

      'statusProjects',

    ]));

    this.syncTicketCounts(this.phaseTickets, this.firstChart(charts, [

      'projectsByPhase',

      'phaseProjects',

    ]));

    this.syncTicketCounts(this.projectManagementTickets, this.firstChart(charts, [

      'projectsByProjectManagementType',

      'projectsByProjectManagement',

      'projectManagementTypeProjects',

      'projectsByManagementType',

    ]));

  }



  /**

   * High-precision sync using the new Grouped Distribution endpoint.

   * This endpoint is designed specifically to match the dashboard's filtering logic.

   */

  private syncTicketCountsFromGroupedDistribution(data: DashboardGroupedDistributionDto): void {

    if (!data) return;



    this.syncGroupedItems(this.businessUnitTickets, data.businessUnits);

    this.syncGroupedItems(this.departmentTickets, data.departments);

    this.syncGroupedItems(this.plantTickets, data.plants);

    this.syncGroupedItems(this.statusTickets, data.status);

    this.syncGroupedItems(this.phaseTickets, data.phases);

    this.syncGroupedItems(this.projectManagementTickets, data.projectManagement);

  }



  private syncGroupedItems(tickets: FilterTicket[], source: any[]): void {

    if (!source || !tickets.length) return;



    const itemsById = new Map<string, any>();

    const itemsByLabel = new Map<string, any>();



    source.forEach(item => {

      if (item.id) itemsById.set(String(item.id).toLowerCase(), item);

      if (item.label) itemsByLabel.set(this.normalizeCountLabel(item.label), item);

    });



    tickets.forEach(ticket => {

      // 1. Try matching by ID first (most precise)

      let sourceItem = itemsById.get(String(ticket.id).toLowerCase());

      

      // 2. Fallback to label matching

      if (!sourceItem) {

        sourceItem = itemsByLabel.get(this.normalizeCountLabel(ticket.label));

      }



      if (sourceItem) {

        ticket.count = sourceItem.count ?? 0;

        ticket.projects = sourceItem.projects ?? [];

      }

    });



    // Update 'All' ticket if it exists and synchronize total projects

    const allTicket = tickets.find(t => t.id === 'all');

    if (allTicket) {

      const total = source.reduce((sum, item) => sum + (item.count || 0), 0);

      allTicket.count = total;

      

      // Update the main totalProjects metric if we are syncing statuses or phases

      // (which should represent the total project count)

      if (tickets === this.statusTickets || tickets === this.phaseTickets) {

        this.totalProjects = total;

      }

    }

  }



  private firstChart(source: Record<string, unknown>, keys: string[]): unknown {

    for (const key of keys) {

      if (source?.[key] !== undefined && source?.[key] !== null) {

        return source[key];

      }

    }



    return null;

  }



  private syncTicketCounts(tickets: FilterTicket[], source: unknown): void {

    const chartItems = this.asLabelValueArray(source);

    if (!chartItems.length || !tickets.length) {

      return;

    }



    const countsByLabel = new Map<string, number>();

    chartItems.forEach((item) => countsByLabel.set(this.normalizeCountLabel(item.label), item.value));



    tickets.forEach((ticket) => {

      const count = countsByLabel.get(this.normalizeCountLabel(ticket.label));

      if (count !== undefined) {

        ticket.count = count;

      }

    });

  }



  private normalizeCountLabel(label: string): string {

    return label

      .trim()

      .toLowerCase()

      .replace(/^bu\s+/i, '')

      .replace(/^plant\s+/i, '')

      .replace(/^departement\s+/i, '')

      .replace(/^department\s+/i, '')

      .replace(/^dept\s+/i, '')

      .replace(/&/g, 'and')

      .replace(/[^a-z0-9]+/g, '');

  }



  private rebuildFilterTickets(projects: any[]): void {

    this.businessUnitTickets = this.filterService.buildBusinessUnitTickets(projects, this.businessUnitIdByName);

    this.departmentTickets = this.filterService.buildDepartmentTickets(projects, this.departmentIdByName);

    this.plantTickets = this.filterService.buildPlantTickets(projects, this.plantIdByName);

    this.projectManagementTickets = this.filterService.buildProjectManagementTypeTickets(projects);

    this.phaseTickets = this.filterService.buildPhaseTickets(projects);

    this.statusTickets = this.filterService.buildStatusTickets(projects);

  }



  private buildProjectParams(params: DashboardFilterParams): any {

    const projectParams: any = {

      pageNumber: 1,

      pageSize: 500,

    };



    if (params.businessUnitId) projectParams.BusinessUnitId = params.businessUnitId;

    if (params.departmentId) projectParams.DepartmentId = params.departmentId;

    if (params.plantId) projectParams.PlantId = params.plantId;

    if (params.year) projectParams.year = params.year;

    if (params.month) projectParams.month = params.month;

    if (params.ytd) projectParams.ytd = params.ytd;

    if (params.startDate) projectParams.startDate = params.startDate;

    if (params.endDate) projectParams.endDate = params.endDate;

    if (params.projectManagementType !== undefined) {

      projectParams.ProjectManagementType = Number(params.projectManagementType);

    }

    if (params.projectStatus !== undefined) {

      projectParams.Status = Number(params.projectStatus);

    }

    if (this.filterState.selectedProjectPhase !== 'all') {

      projectParams.Phase = this.projectPhaseIdToNumber(this.filterState.selectedProjectPhase);

    }



    return projectParams;

  }



  private getSelectedId(kind: FilterKind): string {

    switch (kind) {

      case 'businessUnit':

        return this.filterState.selectedBusinessUnit;

      case 'department':

        return this.filterState.selectedDepartment;

      case 'plant':

        return this.filterState.selectedPlant;

      case 'projectManagement':

        return this.filterState.selectedProjectManagementType;

      case 'phase':

        return this.filterState.selectedProjectPhase;

      case 'status':

        return this.filterState.selectedProjectStatus;

    }

  }



  private projectPhaseIdToNumber(phaseId: string): number {

    const map: Record<string, number> = {

      pipeline: 0,

      preprocess: 1,

      initiation: 2,

      planification: 3,

      execution: 4,

      monitoring: 5,

      closing: 6,

    };



    return map[phaseId] ?? Number(phaseId);

  }



  private formatPercent(value: number): string {

    return `${Number(value || 0).toFixed(1)}%`;

  }



  private syncCalendarPeriod(): void {

    if (!this.filterState.selectedStartDate && !this.filterState.selectedEndDate) {

      this.filterState.selectedYear = null;

      this.filterState.selectedMonth = null;

      return;

    }



    if (!this.filterState.selectedStartDate || !this.filterState.selectedEndDate) {

      this.filterState.selectedYear = null;

      this.filterState.selectedMonth = null;

      return;

    }



    const start = new Date(`${this.filterState.selectedStartDate}T00:00:00`);

    const end = new Date(`${this.filterState.selectedEndDate}T00:00:00`);

    const sameYear = start.getFullYear() === end.getFullYear();

    const sameMonth = start.getMonth() === end.getMonth();

    const isFirstDay = start.getDate() === 1;

    const isLastDay = end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();



    this.filterState.selectedYear = sameYear ? start.getFullYear() : null;

    this.filterState.selectedMonth = sameYear && sameMonth && isFirstDay && isLastDay ? start.getMonth() + 1 : null;

  }



  private formatDateLabel(value: string): string {

    const date = new Date(`${value}T00:00:00`);



    if (Number.isNaN(date.getTime())) {

      return value;

    }



    return new Intl.DateTimeFormat('en', {

      day: '2-digit',

      month: 'short',

      year: 'numeric',

    }).format(date);

  }



  private toDateInputValue(date: Date): string {

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, '0');

    const day = String(date.getDate()).padStart(2, '0');



    return `${year}-${month}-${day}`;

  }

}

