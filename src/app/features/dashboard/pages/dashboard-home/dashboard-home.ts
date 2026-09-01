import { FilterKind, FilterSection, DashboardStatsSnapshot } from '../../models/dashboard-home.models';
import { DashboardMetric } from '../../models/dashboard-metric.model';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

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

import {
  DashboardCreatedProjectDto,
  DashboardFilterParams,
  DashboardGroupedDistributionDto,
  GroupedDistributionItem,
} from '../../../projects/models';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);



  readonly user: User | null = this.authService.getCurrentUser();

  readonly currentYear = new Date().getFullYear();

  readonly currentMonth = new Date().getMonth() + 1;

  readonly currentFiscalYear = this.getCurrentFiscalYear();

  readonly monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  readonly yearOptions = Array.from({ length: 8 }, (_, index) => this.currentFiscalYear + 1 - index);

  filterState: DashboardFilterState = this.filterService.defaultFilterState();



  isLoading = true;

  isRefreshing = false;

  hasLoadedDashboard = false;

  errorMessage = '';
  normalUserView: 'projects' | 'personal' = 'projects';
  projectStatsScope: 'mine' | 'all' = 'mine';



  totalProjects = 0;

  averageOtd = 0;

  averageEffectiveness = 0;

  aboveTargetCount = 0;

  belowTargetCount = 0;

  delayedProjects = 0;
  createdProjectsCount = 0;
  createdProjects: DashboardCreatedProjectDto[] = [];
  createdProjectsExpanded = false;
  personalLoggedHours = 0;
  personalYtdHours = 0;
  personalExpectedHours = 0;
  personalUtilizationRate = 0;
  personalLoggedDays = 0;
  personalAssignedProjects = 0;
  personalDelayedProjects = 0;



  businessUnitTickets: FilterTicket[] = [];

  departmentTickets: FilterTicket[] = [];

  plantTickets: FilterTicket[] = [];

  projectManagementTickets: FilterTicket[] = [];

  phaseTickets: FilterTicket[] = [];

  statusTickets: FilterTicket[] = [];

  expandedSections = new Set<FilterKind>();

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

    if (this.filterState.selectedYtd && this.filterState.selectedYear) {

      return this.fiscalYtdLabel(this.filterState.selectedYear);

    }

    if (this.filterState.selectedStartDate && this.filterState.selectedEndDate) {

      return `${this.formatDateLabel(this.filterState.selectedStartDate)} - ${this.formatDateLabel(this.filterState.selectedEndDate)}`;

    }



    if (this.filterState.selectedStartDate) {

      return `Since ${this.formatDateLabel(this.filterState.selectedStartDate)}`;

    }



    if (this.filterState.selectedEndDate) {

      return `Until ${this.formatDateLabel(this.filterState.selectedEndDate)}`;

    }



    return 'All dates';

  }

  get isNormalUserPersonalView(): boolean {
    return !this.user?.isAdmin && this.normalUserView === 'personal';
  }

  get isAllProjectStatsView(): boolean {
    return !!this.user && !this.user.isAdmin && this.normalUserView === 'projects' && this.projectStatsScope === 'all';
  }

  get visibleCreatedProjects(): DashboardCreatedProjectDto[] {
    return this.createdProjectsExpanded ? this.createdProjects : this.createdProjects.slice(0, 3);
  }

  get hiddenCreatedProjectsCount(): number {
    return Math.max(this.createdProjects.length - 3, 0);
  }



  get metrics(): DashboardMetric[] {
    if (this.isNormalUserPersonalView) {
      return [
        {
          label: 'Logged hours',
          value: `${this.formatHours(this.personalLoggedHours)}`,
          note: 'Personal total for the selected period',
          icon: 'schedule',
          tone: 'blue',
          actionLabel: 'View my entries',
        },
        {
          label: 'Progress',
          value: `${this.formatPercent(this.personalUtilizationRate)}`,
          note: 'Progress against the expected target',
          icon: 'auto_graph',
          tone: this.personalUtilizationRate >= 90 ? 'green' : 'orange',
          actionLabel: 'View summary',
        },
        {
          label: 'Logged days',
          value: `${this.personalLoggedDays}`,
          note: 'Days with logged hours',
          icon: 'event_available',
          tone: 'green',
          actionLabel: 'View my hours',
        },
        {
          label: 'Assigned projects',
          value: `${this.personalAssignedProjects}`,
          note: `${this.personalDelayedProjects} delayed project(s)`,
          icon: 'workspaces',
          tone: this.personalDelayedProjects > 0 ? 'red' : 'blue',
          actionLabel: 'View my projects',
        },
      ];
    }

    const projectMetrics: DashboardMetric[] = [

      {

        label: 'Projects',

        value: `${this.totalProjects}`,

        note: this.user?.isAdmin || this.projectStatsScope === 'all'
          ? 'Projects matching the active filters'
          : 'My projects matching the active filters',

        icon: 'inventory_2',

        tone: 'blue',
        actionLabel: 'View projects',

      },

      {

        label: 'OTD',

        value: `${this.formatPercent(this.averageOtd)}`,

        note: 'On-time delivery for the selected scope',

        icon: 'verified',

        tone: this.averageOtd >= 90 ? 'green' : 'orange',
        actionLabel: 'View KPI analytics',

      },

      {

        label: 'Effectiveness',

        value: `${this.formatPercent(this.averageEffectiveness)}`,

        note: 'Execution effectiveness for the selected scope',

        icon: 'auto_graph',

        tone: this.averageEffectiveness >= 90 ? 'green' : 'orange',
        actionLabel: 'View KPI analytics',

      },

      {

        label: 'Delayed',

        value: `${this.delayedProjects}`,

        note: 'Projects needing attention',

        icon: 'timer_off',

        tone: this.delayedProjects > 0 ? 'red' : 'green',
        actionLabel: 'View delayed projects',

      }

    ];

    return projectMetrics;
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



  private buildSection(
    kind: FilterKind,
    title: string,
    icon: string,
    allTickets: FilterTicket[],
    selectedId: string
  ): FilterSection {
    const validTickets = allTickets.filter(t => t.id !== 'all' && !!t.label && t.count > 0);
    let visibleTickets = validTickets;
    let hiddenCount = 0;

    if (validTickets.length > 4) {
      hiddenCount = validTickets.length - 4;
      if (!this.expandedSections.has(kind)) {
        visibleTickets = validTickets.slice(0, 4);
        // Ensure selected item is visible
        if (selectedId !== 'all' && !visibleTickets.some(t => t.id === selectedId)) {
          const selItem = validTickets.find(t => t.id === selectedId);
          if (selItem) {
            visibleTickets[3] = selItem;
          }
        }
      }
    }

    return {
      kind,
      title,
      icon,
      tickets: validTickets,
      selectedId,
      visibleTickets,
      hiddenCount
    };
  }

  get filterSections(): FilterSection[] {
    return [
      this.buildSection('projectManagement', 'Project management', 'manage_accounts', this.projectManagementTickets, this.filterState.selectedProjectManagementType),
      this.buildSection('status', 'Project status', 'radio_button_checked', this.statusTickets, this.filterState.selectedProjectStatus),
      this.buildSection('phase', 'Project phases', 'layers', this.phaseTickets, this.filterState.selectedProjectPhase),
      this.buildSection('businessUnit', 'Business units', 'corporate_fare', this.businessUnitTickets, this.filterState.selectedBusinessUnit),
      this.buildSection('department', 'Departments', 'business', this.departmentTickets, this.filterState.selectedDepartment),
      this.buildSection('plant', 'Plants', 'factory', this.plantTickets, this.filterState.selectedPlant),
    ].filter(section => section.tickets.length > 0);
  }

  setNormalUserView(view: 'projects' | 'personal'): void {
    this.normalUserView = view;
    this.cdr.markForCheck();
  }

  setProjectStatsScope(scope: 'mine' | 'all'): void {
    if (this.isLoading || this.isRefreshing) {
      return;
    }

    if (this.projectStatsScope === scope && this.normalUserView === 'projects') {
      return;
    }

    const shouldReload = this.projectStatsScope !== scope;
    this.projectStatsScope = scope;
    this.normalUserView = 'projects';

    if (shouldReload) {
      this.loadDashboard();
      return;
    }

    this.cdr.markForCheck();
  }



  ngOnInit(): void {

    this.restoreFilterStateFromQueryParams();

    this.loadReferenceData();

  }

  toggleSection(kind: FilterKind): void {
    if (this.expandedSections.has(kind)) {
      this.expandedSections.delete(kind);
    } else {
      this.expandedSections.add(kind);
    }
    this.cdr.markForCheck();
  }

  isSectionExpanded(kind: FilterKind): boolean {
    return this.expandedSections.has(kind);
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

  navigateToProjectsWithFilters(extraQueryParams: Record<string, unknown> = {}): void {
    const projectScope = this.getProjectNavigationScope();
    const queryParams = this.buildProjectsQueryParamsFromDashboardFilters();

    void this.router.navigate(['/projects'], {
      queryParams: {
        ...queryParams,
        projectScope,
        all: projectScope === 'all',
        dashboardView: this.getDashboardViewNavigationParam(),
        ...extraQueryParams,
        source: 'dashboard',
      },
    });
  }

  private buildProjectsQueryParamsFromDashboardFilters(): Record<string, string | number | boolean> {
    const queryParams: Record<string, string | number | boolean> = {};

    if (this.filterState.selectedBusinessUnit !== 'all') {
      queryParams['BusinessUnitId'] = this.filterState.selectedBusinessUnit;
    }
    if (this.filterState.selectedDepartment !== 'all') {
      queryParams['DepartmentId'] = this.filterState.selectedDepartment;
    }
    if (this.filterState.selectedPlant !== 'all') {
      queryParams['PlantId'] = this.filterState.selectedPlant;
    }
    if (this.filterState.selectedProjectManagementType !== 'all') {
      const value = this.projectManagementTypeIdToNumber(this.filterState.selectedProjectManagementType);
      if (Number.isFinite(value)) {
        queryParams['ProjectManagementType'] = value;
      }
    }
    if (this.filterState.selectedProjectPhase !== 'all') {
      const value = this.projectPhaseIdToNumber(this.filterState.selectedProjectPhase);
      if (Number.isFinite(value)) {
        queryParams['Phase'] = value;
      }
    }
    if (this.filterState.selectedProjectStatus !== 'all') {
      const value = this.projectStatusIdToNumber(this.filterState.selectedProjectStatus);
      if (Number.isFinite(value)) {
        queryParams['Status'] = value;
      }
    }
    if (this.filterState.selectedStartDate) {
      queryParams['startDate'] = this.filterState.selectedStartDate;
    }
    if (this.filterState.selectedEndDate) {
      queryParams['endDate'] = this.filterState.selectedEndDate;
    }
    if (this.filterState.selectedYear) {
      queryParams['year'] = this.filterState.selectedYear;
    }
    if (this.filterState.selectedMonth) {
      queryParams['month'] = this.filterState.selectedMonth;
    }
    if (this.filterState.selectedYtd) {
      queryParams['ytd'] = true;
    }
    if (this.filterState.selectedProcessStatus !== 'all') {
      queryParams['ProcessStatus'] = this.filterState.selectedProcessStatus;
    }

    return queryParams;
  }

  private getProjectNavigationScope(): 'mine' | 'all' {
    if (this.user?.isAdmin) {
      return 'all';
    }

    if (this.isNormalUserPersonalView) {
      return 'mine';
    }

    return this.projectStatsScope;
  }

  private getDashboardViewNavigationParam(): 'admin' | 'mine' | 'all' | 'personal' {
    if (this.user?.isAdmin) {
      return 'admin';
    }

    if (this.isNormalUserPersonalView) {
      return 'personal';
    }

    return this.projectStatsScope;
  }

  openMetricTarget(metric: DashboardMetric): void {
    const label = metric.label.toLowerCase();

    if (this.isNormalUserPersonalView) {
      if (label.includes('project')) {
        this.navigateToProjectsWithFilters();
        return;
      }

      void this.router.navigate(['/hours/summary']);
      return;
    }

    if (label === 'delayed') {
      this.navigateToProjectsWithFilters({ DelayedOnly: true });
      return;
    }

    if (label === 'projects') {
      this.navigateToProjectsWithFilters();
      return;
    }

    if (label === 'financials') {
      void this.router.navigate(['/dashboard/capacity-price']);
      return;
    }

    void this.router.navigate(['/dashboard/analytics']);
  }

  openCreatedProject(project: DashboardCreatedProjectDto): void {
    if (!project.projectId) {
      return;
    }

    void this.router.navigate(['/projects', project.projectId]);
  }

  toggleCreatedProjects(): void {
    this.createdProjectsExpanded = !this.createdProjectsExpanded;
  }

  formatCreatedProjectDate(value: string): string {
    return this.formatDateLabel(value);
  }

  openTicketProjects(section: FilterSection, ticket: FilterTicket): void {
    const extraQueryParams: Record<string, unknown> = {};

    switch (section.kind) {
      case 'businessUnit':
        extraQueryParams['BusinessUnitId'] = ticket.id;
        break;
      case 'department':
        extraQueryParams['DepartmentId'] = ticket.id;
        break;
      case 'plant':
        extraQueryParams['PlantId'] = ticket.id;
        break;
      case 'projectManagement':
        extraQueryParams['ProjectManagementType'] = this.projectManagementTypeIdToNumber(ticket.id);
        break;
      case 'phase':
        extraQueryParams['Phase'] = this.projectPhaseIdToNumber(ticket.id);
        break;
      case 'status':
        extraQueryParams['Status'] = this.projectStatusIdToNumber(ticket.id);
        break;
    }

    this.navigateToProjectsWithFilters(extraQueryParams);
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



  selectCurrentMonth(): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    this.filterState.selectedYear = this.currentYear;

    this.filterState.selectedMonth = this.currentMonth;

    this.filterState.selectedYtd = false;

    this.filterState.selectedStartDate = null;

    this.filterState.selectedEndDate = null;

    this.loadDashboard();

  }



  selectAllDates(): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }



    this.filterState.selectedYear = null;

    this.filterState.selectedMonth = null;

    this.filterState.selectedYtd = false;

    this.filterState.selectedStartDate = null;

    this.filterState.selectedEndDate = null;

    this.loadDashboard();

  }

  selectYtd(): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }

    this.filterState.selectedYear = this.filterState.selectedYear ?? this.currentFiscalYear;

    this.filterState.selectedMonth = null;

    this.filterState.selectedYtd = true;

    this.filterState.selectedStartDate = null;

    this.filterState.selectedEndDate = null;

    this.loadDashboard();

  }

  updatePeriodFilter(kind: 'month' | 'year', event: Event): void {

    if (this.isLoading || this.isRefreshing) {

      return;

    }

    const input = event.target as HTMLSelectElement;

    const value = input.value ? Number(input.value) : null;

    if (kind === 'year') {

      this.filterState.selectedYear = value;

      if (value === null) {

        this.filterState.selectedMonth = null;

        this.filterState.selectedYtd = false;

      }

    } else {

      this.filterState.selectedMonth = value;

      this.filterState.selectedYtd = false;

      if (value !== null && this.filterState.selectedYear === null) {

        this.filterState.selectedYear = this.currentYear;

      }

    }

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

    this.filterState.selectedYtd = false;



    this.syncCalendarPeriod();

    this.loadDashboard();

  }



  trackByTicketId(_: number, ticket: FilterTicket): string {

    return ticket.id;

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

        this.initializeFilterTickets();



        this.loadDashboard();

      },

      error: () => {

        this.isLoading = false;

        this.errorMessage = 'Unable to load dashboard filters.';

        this.cdr.markForCheck();

      },

    });

  }

  private initializeFilterTickets(): void {

    this.departmentTickets = this.filterService.buildDepartmentTickets([], this.departmentIdByName);

    this.businessUnitTickets = this.filterService.buildBusinessUnitTickets([], this.businessUnitIdByName);

    this.plantTickets = this.filterService.buildPlantTickets([], this.plantIdByName);

    this.statusTickets = this.filterService.buildStatusTickets([]);

    this.phaseTickets = this.filterService.buildPhaseTickets([]);

    this.projectManagementTickets = this.filterService.buildProjectManagementTypeTickets([]);

  }



  private loadDashboard(): void {

    const isInitialLoad = !this.hasLoadedDashboard;

    this.isLoading = isInitialLoad;

    this.isRefreshing = !isInitialLoad;

    this.errorMessage = '';



    const dashboardParams = this.filterService.buildParams(this.filterState);

    forkJoin({

      dashboard: this.loadDashboardSummary(dashboardParams).pipe(catchError(() => of(null))),

      performance: this.loadDashboardPerformance(dashboardParams).pipe(catchError(() => of(null))),

      dashboardBi: this.loadDashboardBi(dashboardParams).pipe(catchError(() => of(null))),

      groupedDistributions: this.loadGroupedDistributions(dashboardParams),

    })

      .pipe(

        finalize(() => {

          this.isRefreshing = false;

          this.cdr.markForCheck();

        })

      )

      .subscribe(({ dashboard, performance, dashboardBi, groupedDistributions }) => {

        

        if (!dashboard) {

          this.errorMessage = 'Unable to load dashboard stats right now.';

          this.isLoading = false;

          return;

        }



        const stats = this.mergeProjectDashboardStats(
          this.extractDashboardStats(dashboard.raw ?? dashboard, Number.NaN),
          dashboardBi ? this.extractDashboardStats(dashboardBi.raw ?? dashboardBi, Number.NaN) : null
        );

        this.totalProjects = stats.totalProjects;

        this.averageOtd = stats.averageOtd;

        this.averageEffectiveness = stats.averageEffectiveness;

        this.delayedProjects = stats.delayedProjects;

        this.applyCreatedProjects(dashboard.raw ?? dashboard);

        this.aboveTargetCount = stats.aboveTargetCount;

        this.belowTargetCount = stats.belowTargetCount;

        if (performance && !this.user?.isAdmin) {
          this.applyUserPerformance(performance.raw ?? performance);
        }

        // Reset scoped ticket counts before applying the new dashboard payload.
        // Some endpoints omit zero-count buckets, so keeping previous counts
        // would leak "All projects" values back into "My project stats".
        this.resetTicketCounts();

        // Apply counts from BI/Extended if available

        this.syncTicketCountsFromDashboard(dashboard.raw ?? dashboard);

        if (dashboardBi) {

          this.syncTicketCountsFromDashboard(dashboardBi.raw ?? dashboardBi);

        }



        // Override/supplement with high-precision counts from the grouped distribution endpoint.

        if (groupedDistributions) {

          this.syncTicketCountsFromGroupedDistributions(groupedDistributions);

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

    if (this.projectStatsScope === 'all') {

      return this.projectService.getAllProjectsDashboardExtended(params).pipe(

        map((dashboard: any) => ({

          summary: dashboard?.summary ?? {},

          raw: dashboard,

        }))

      );

    }



    return this.projectService.getUserDashboardExtended(params).pipe(

      map((dashboard: any) => ({

        summary: dashboard?.summary ?? {},

        raw: dashboard,

      }))

    );

  }



  private loadDashboardBi(params: DashboardFilterParams): Observable<{ raw: any } | null> {

    const request$ = this.user?.isAdmin
      ? this.projectService.getAdminDashboardBi(params)
      : this.projectStatsScope === 'all'
        ? this.projectService.getAllProjectsDashboardBi(params)
        : this.projectService.getUserDashboardBi(params);

    return request$.pipe(

      map((dashboard: any) => ({

        raw: dashboard,

      }))

    );

  }

  private loadDashboardPerformance(params: DashboardFilterParams): Observable<{ raw: any } | null> {

    if (this.user?.isAdmin) {

      return of(null);

    }

    return this.projectService.getUserDashboardPerformance(params).pipe(

      map((dashboard: any) => ({

        raw: dashboard,

      }))

    );

  }

  private loadMyProjectStats(): Observable<{ raw: any } | null> {

    if (this.user?.isAdmin) {

      return of(null);

    }

    return this.projectService.getMyProjectStats().pipe(

      map((stats: any) => ({

        raw: stats,

      }))

    );

  }

  private applyUserPerformance(rawPerformance: any): void {

    const summary = rawPerformance?.summary ?? rawPerformance ?? {};

    this.personalLoggedHours = this.firstNumber([
      summary.totalLoggedHours,
      summary.TotalLoggedHours,
      summary.loggedHours,
      summary.LoggedHours,
    ], 0);

    this.personalYtdHours = this.firstNumber([
      summary.ytdLoggedHours,
      summary.YtdLoggedHours,
      summary.ytdHours,
      summary.YtdHours,
    ], 0);

    this.personalExpectedHours = this.firstNumber([
      summary.expectedHours,
      summary.ExpectedHours,
      summary.targetHours,
      summary.TargetHours,
    ], 0);

    this.personalLoggedDays = this.firstNumber([
      summary.loggedDays,
      summary.LoggedDays,
    ], 0);

    this.personalAssignedProjects = this.firstNumber([
      summary.assignedProjects,
      summary.AssignedProjects,
      summary.projectsWithLoggedHours,
      summary.ProjectsWithLoggedHours,
    ], 0);

    this.personalDelayedProjects = this.firstNumber([
      summary.delayedAssignedProjects,
      summary.DelayedAssignedProjects,
    ], 0);

    this.personalUtilizationRate = this.firstNumber([
      summary.utilizationRate,
      summary.UtilizationRate,
      summary.annualGoalProgressPercentage,
      summary.AnnualGoalProgressPercentage,
    ], 0);

  }

  private applyMyProjectStats(rawStats: any): void {

    const stats = rawStats?.summary ?? rawStats ?? {};

    const total = this.firstNumber([
      stats.totalProjects,
      stats.TotalProjects,
      stats.assignedProjects,
      stats.AssignedProjects,
      stats.projectCount,
      stats.ProjectCount,
    ], NaN);

    const delayed = this.firstNumber([
      stats.delayedProjects,
      stats.DelayedProjects,
      stats.delayedAssignedProjects,
      stats.DelayedAssignedProjects,
    ], NaN);

    if (Number.isFinite(total)) {
      this.totalProjects = total;
    }

    if (Number.isFinite(delayed)) {
      this.delayedProjects = delayed;
    }

  }

  private loadGroupedDistributions(params: DashboardFilterParams): Observable<DashboardGroupedDistributionDto | null> {

    if (!this.user?.isAdmin) {

      return of(null);

    }

    return this.projectService.getAdminDashboardGroupedDistribution(params).pipe(catchError(() => of(null)));

  }

  private applyCreatedProjects(rawDashboard: any): void {
    const summary = rawDashboard?.summary ?? rawDashboard ?? {};
    const rawProjects = rawDashboard?.createdProjects ?? rawDashboard?.CreatedProjects;

    this.createdProjects = Array.isArray(rawProjects)
      ? rawProjects
          .map((project: any): DashboardCreatedProjectDto => ({
            projectId: String(project?.projectId ?? project?.ProjectId ?? project?.id ?? project?.Id ?? '').trim(),
            name: String(project?.name ?? project?.Name ?? project?.nom ?? project?.projectName ?? project?.ProjectName ?? '').trim(),
            status: project?.status ?? project?.Status ?? project?.statut ?? '',
            phase: project?.phase ?? project?.Phase ?? '',
            createdAt: String(project?.createdAt ?? project?.CreatedAt ?? ''),
          }))
          .filter((project: DashboardCreatedProjectDto) => project.projectId || project.name)
      : [];

    const responseCount = Number(summary?.createdProjects ?? summary?.CreatedProjects);
    this.createdProjectsCount = Number.isFinite(responseCount) ? responseCount : this.createdProjects.length;
    this.createdProjectsExpanded = false;
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

  private mergeProjectDashboardStats(
    primary: DashboardStatsSnapshot,
    secondary: DashboardStatsSnapshot | null
  ): DashboardStatsSnapshot {
    return {
      totalProjects: this.metricOrFallback(primary.totalProjects, secondary?.totalProjects, 0),
      averageOtd: this.metricOrFallback(primary.averageOtd, secondary?.averageOtd, 0),
      averageEffectiveness: this.metricOrFallback(primary.averageEffectiveness, secondary?.averageEffectiveness, 0),
      delayedProjects: this.metricOrFallback(primary.delayedProjects, secondary?.delayedProjects, 0),
      aboveTargetCount: this.metricOrFallback(primary.aboveTargetCount, secondary?.aboveTargetCount, 0),
      belowTargetCount: this.metricOrFallback(primary.belowTargetCount, secondary?.belowTargetCount, 0),
    };
  }

  private metricOrFallback(primary: number, secondary: number | undefined, fallback: number): number {
    if (Number.isFinite(primary)) {
      return primary;
    }

    if (Number.isFinite(secondary)) {
      return secondary as number;
    }

    return fallback;
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

  private syncTicketCountsFromGroupedDistributions(data: DashboardGroupedDistributionDto): void {

    if (!data) return;

    this.businessUnitTickets = this.mergeGroupedItemsWithTickets(this.businessUnitTickets, data.businessUnits);

    this.departmentTickets = this.mergeGroupedItemsWithTickets(this.departmentTickets, data.departments);

    this.plantTickets = this.mergeGroupedItemsWithTickets(this.plantTickets, data.plants);

    this.statusTickets = this.groupedOptionsToTickets(
      DashboardFilterService.PROJECT_STATUS_OPTIONS,
      data.status
    );

    this.phaseTickets = this.groupedOptionsToTickets(
      DashboardFilterService.PROJECT_PHASE_OPTIONS,
      data.phases
    );

    this.projectManagementTickets = this.groupedOptionsToTickets(
      DashboardFilterService.PROJECT_MANAGEMENT_TYPE_OPTIONS,
      data.projectManagement
    );

  }

  private groupedItemsToTickets(source: GroupedDistributionItem[] | null | undefined): FilterTicket[] {

    return (source ?? [])
      .map((item) => ({
        id: String(item.id || item.label),
        label: item.label,
        count: item.count ?? 0,
        projects: item.projects ?? [],
      }))
      .filter((ticket) => ticket.id && ticket.label)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  }

  private groupedOptionsToTickets(
    options: Array<{ id: string; label: string }>,
    source: GroupedDistributionItem[] | null | undefined
  ): FilterTicket[] {

    const sourceItems = source ?? [];
    const total = sourceItems.reduce((sum, item) => sum + (item.count || 0), 0);
    const itemsById = new Map<string, GroupedDistributionItem>();
    const itemsByLabel = new Map<string, GroupedDistributionItem>();

    sourceItems.forEach((item) => {
      if (item.id) itemsById.set(String(item.id).toLowerCase(), item);
      if (item.label) itemsByLabel.set(this.normalizeCountLabel(item.label), item);
    });

    return options.map((option) => {
      if (option.id === 'all') {
        return { ...option, count: total };
      }

      const sourceItem =
        itemsById.get(String(option.id).toLowerCase()) ??
        itemsByLabel.get(this.normalizeCountLabel(option.label));

      return {
        ...option,
        count: sourceItem?.count ?? 0,
        projects: sourceItem?.projects ?? [],
      };
    });

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
    const normalized = this.normalizeProjectQueryValue(phaseId);

    const map: Record<string, number> = {

      pipeline: 0,
      preproccess: 1,

      preprocess: 1,

      initiation: 2,

      planification: 3,

      execution: 4,

      monitoring: 5,

      closing: 6,

    };



    return map[normalized] ?? Number(phaseId);

  }

  private projectStatusIdToNumber(statusId: string): number {
    const normalized = this.normalizeProjectQueryValue(statusId);

    const map: Record<string, number> = {

      ongoing: 0,

      onhold: 1,

      done: 2,

      planned: 3,

    };

    return map[normalized] ?? Number(statusId);

  }

  private projectManagementTypeIdToNumber(typeId: string): number {
    const normalized = this.normalizeProjectQueryValue(typeId);

    const map: Record<string, number> = {

      DigitalOperation: 0,
      digitaloperation: 0,

      DigitalSolution: 1,
      digitalsolution: 1,
      digitalsolutions: 1,

      Infrastructure: 2,
      infrastructure: 2,

      ProcessSimplification: 3,
      processsimplification: 3,

      Other: 4,
      other: 4,

    };

    return map[typeId] ?? map[normalized] ?? Number(typeId);

  }

  private normalizeProjectQueryValue(value: string): string {
    return `${value ?? ''}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private restoreFilterStateFromQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    const hasExplicitDates = params.has('startDate') || params.has('endDate');
    const dashboardView = `${params.get('dashboardView') ?? params.get('DashboardView') ?? ''}`.toLowerCase();
    const projectScope = params.get('projectScope') ?? params.get('ProjectScope');

    if (!this.user?.isAdmin && dashboardView === 'personal') {
      this.normalUserView = 'personal';
    } else if (!this.user?.isAdmin && (dashboardView === 'mine' || dashboardView === 'all')) {
      this.normalUserView = 'projects';
      this.projectStatsScope = dashboardView;
    } else if (!this.user?.isAdmin && (projectScope === 'mine' || projectScope === 'all')) {
      this.normalUserView = 'projects';
      this.projectStatsScope = projectScope;
    }

    this.filterState.selectedBusinessUnit = params.get('BusinessUnitId') ?? params.get('businessUnitId') ?? this.filterState.selectedBusinessUnit;
    this.filterState.selectedDepartment = params.get('DepartmentId') ?? params.get('departmentId') ?? this.filterState.selectedDepartment;
    this.filterState.selectedPlant = params.get('PlantId') ?? params.get('plantId') ?? this.filterState.selectedPlant;
    this.filterState.selectedProjectManagementType = this.projectManagementTypeNumberToId(params.get('ProjectManagementType') ?? params.get('projectManagementType')) ?? this.filterState.selectedProjectManagementType;
    this.filterState.selectedProjectPhase = this.projectPhaseNumberToId(params.get('Phase') ?? params.get('phase')) ?? this.filterState.selectedProjectPhase;
    this.filterState.selectedProjectStatus = this.projectStatusNumberToId(params.get('Status') ?? params.get('status')) ?? this.filterState.selectedProjectStatus;
    this.filterState.selectedProcessStatus = params.get('ProcessStatus') ?? params.get('processStatus') ?? this.filterState.selectedProcessStatus;
    this.filterState.selectedStartDate = params.get('startDate') ?? this.filterState.selectedStartDate;
    this.filterState.selectedEndDate = params.get('endDate') ?? this.filterState.selectedEndDate;
    this.filterState.selectedYear = this.queryNumber(params.get('year')) ?? this.filterState.selectedYear;
    this.filterState.selectedMonth = this.queryNumber(params.get('month')) ?? this.filterState.selectedMonth;
    this.filterState.selectedYtd = this.queryBoolean(params.get('ytd')) ?? this.filterState.selectedYtd;

    if (this.filterState.selectedYtd) {
      this.filterState.selectedMonth = null;
      this.filterState.selectedStartDate = null;
      this.filterState.selectedEndDate = null;
    } else if (hasExplicitDates) {
      this.syncCalendarPeriod();
    }
  }

  private projectManagementTypeNumberToId(value: string | null): string | null {
    const map: Record<string, string> = {
      '0': 'DigitalOperation',
      '1': 'DigitalSolution',
      '2': 'Infrastructure',
      '3': 'ProcessSimplification',
      '4': 'Other',
    };

    return value !== null ? map[value] ?? value : null;
  }

  private projectPhaseNumberToId(value: string | null): string | null {
    const map: Record<string, string> = {
      '0': 'pipeline',
      '1': 'preprocess',
      '2': 'initiation',
      '3': 'planification',
      '4': 'execution',
      '5': 'monitoring',
      '6': 'closing',
    };

    return value !== null ? map[value] ?? value : null;
  }

  private projectStatusNumberToId(value: string | null): string | null {
    const map: Record<string, string> = {
      '0': 'ongoing',
      '1': 'onhold',
      '2': 'done',
      '3': 'planned',
    };

    return value !== null ? map[value] ?? value : null;
  }

  private queryNumber(value: string | null): number | null {
    if (value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private queryBoolean(value: string | null): boolean | null {
    if (value === null || value === '') {
      return null;
    }

    return ['true', '1', 'yes', 'ytd'].includes(value.toLowerCase());
  }



  private formatPercent(value: number): string {

    return `${Number(value || 0).toFixed(1)}%`;

  }

  private resetTicketCounts(): void {
    this.businessUnitTickets = this.businessUnitTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
    this.departmentTickets = this.departmentTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
    this.plantTickets = this.plantTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
    this.statusTickets = this.statusTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
    this.phaseTickets = this.phaseTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
    this.projectManagementTickets = this.projectManagementTickets.map((ticket) => ({ ...ticket, count: 0, projects: [] }));
  }

  private mergeGroupedItemsWithTickets(
    baseTickets: FilterTicket[],
    source: GroupedDistributionItem[] | null | undefined
  ): FilterTicket[] {

    const sourceTickets = this.groupedItemsToTickets(source);

    if (!baseTickets.length) {

      return sourceTickets;

    }

    const sourceById = new Map(sourceTickets.map((ticket) => [ticket.id.toLowerCase(), ticket]));

    const sourceByLabel = new Map(
      sourceTickets.map((ticket) => [this.normalizeCountLabel(ticket.label), ticket])
    );

    const merged: FilterTicket[] = baseTickets.map((ticket) => {

      const sourceTicket =
        sourceById.get(ticket.id.toLowerCase()) ??
        sourceByLabel.get(this.normalizeCountLabel(ticket.label));

      return {
        ...ticket,
        count: sourceTicket?.count ?? 0,
        projects: sourceTicket?.projects ?? [],
      };

    });

    const knownIds = new Set(merged.map((ticket) => ticket.id.toLowerCase()));
    const knownLabels = new Set(merged.map((ticket) => this.normalizeCountLabel(ticket.label)));

    sourceTickets.forEach((ticket) => {

      if (!knownIds.has(ticket.id.toLowerCase()) && !knownLabels.has(this.normalizeCountLabel(ticket.label))) {

        merged.push(ticket);

      }

    });

    return merged.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  }

  private formatHours(value: number): string {

    return `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;

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

  private syncDatesFromPeriodSelection(): void {
    this.filterState.selectedStartDate = null;

    this.filterState.selectedEndDate = null;

  }

  private getCurrentFiscalYear(): number {
    return this.currentMonth >= 10 ? this.currentYear + 1 : this.currentYear;
  }

  private fiscalYtdLabel(fiscalYear: number): string {
    const start = new Date(fiscalYear - 1, 9, 1);
    const end =
      fiscalYear === this.currentFiscalYear
        ? new Date(this.currentYear, this.currentMonth - 1, 1)
        : new Date(fiscalYear, 8, 1);

    return `YTD FY${fiscalYear} (${this.formatMonthYear(start)} - ${this.formatMonthYear(end)})`;
  }

  private formatMonthYear(date: Date): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      year: 'numeric',
    }).format(date);
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

