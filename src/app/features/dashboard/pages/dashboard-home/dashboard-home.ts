import { ChangeDetectorRef, Component, NgZone, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { User } from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth';
import { DepartmentsApiService } from '../../../../core/services/departments-api.service';
import { PlantsApiService } from '../../../../core/services/plants-api.service';
import { HourEntriesApiService } from '../../../../core/services/hour-entries-api.service';
import { RolesApiService } from '../../../../core/services/roles-api.service';
import { BusinessUnitsApiService } from '../../../../core/services/business-units-api.service';
import {
  DashboardPerformanceProjectDto,
} from '../../../projects/models';
import { ProjectService } from '../../../projects/services/project';
import { 
  DashboardCalculationService, 
  ChartBar as IChartBar, 
  BiTrendPoint, 
  BiAlertItem, 
  MetricCard as IMetricCard 
} from '../../services/dashboard-calculation.service';
import { DashboardFilterService, FilterTicket } from '../../services/dashboard-filter.service';

// Import Standalone Components
import { MetricCardComponent } from '../../components/metric-card/metric-card.component';
import { ChartBarComponent } from '../../components/chart-bar/chart-bar.component';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    MetricCardComponent,
    ChartBarComponent,
  ],
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.scss'],
})
export class DashboardHome implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly hourEntriesApi = inject(HourEntriesApiService);
  private readonly rolesApi = inject(RolesApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly businessUnitsApi = inject(BusinessUnitsApiService);
  private readonly plantsApi = inject(PlantsApiService);
  private readonly calc = inject(DashboardCalculationService);
  private readonly filterService = inject(DashboardFilterService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);

  readonly user: User | null = this.authService.getCurrentUser();
  private readonly projectNameById = new Map<string, string>();
  private readonly departmentIdByName = new Map<string, string>();
  private readonly businessUnitIdByName = new Map<string, string>();
  private readonly plantIdByName = new Map<string, string>();

  // --- UI State ---
  public isLoading = true;
  public errorMessage = '';
  public periodPickerOpen = false;
  public capacityMax = 2500;

  // --- Data Models ---
  public filterState = this.filterService.defaultFilterState();
  public performanceMetrics: IMetricCard[] = [];
  public financialMetrics: IMetricCard[] = [];
  public userMetrics: IMetricCard[] = [];
  
  public projectStatusBars: IChartBar[] = [];
  public topProjectBars: IChartBar[] = [];
  public hoursStageBars: IChartBar[] = [];
  public premiumHoursBars: IChartBar[] = [];
  public personalProjects: DashboardPerformanceProjectDto[] = [];
  public highRiskProjects: any[] = [];
  
  public workloadDepartmentBars: IChartBar[] = [];
  public workloadBusinessUnitBars: IChartBar[] = [];
  public workloadRoleBars: IChartBar[] = [];
  public userStatusBars: IChartBar[] = [];
  public costSavingDepartmentBars: IChartBar[] = [];
  public costSavingBusinessUnitBars: IChartBar[] = [];
  
  public effortDistribution: IChartBar[] = [];
  public monthlyEffortTrend: any[] = [];
  public monthlyWorkloadTrend: any[] = [];
  public performanceTrend: BiTrendPoint[] = [];
  public biAlerts: BiAlertItem[] = [];
  public delayRateBars: IChartBar[] = [];
  public projectsByPlantBars: IChartBar[] = [];
  public projectsByBUBars: IChartBar[] = [];
  
  public businessStats: any = null;
  public totalHoursYtd: number = 0;
  public annualGoalProgress: number = 0;
  public aboveTargetCount: number = 0;
  public belowTargetCount: number = 0;

  // --- Filter Options ---
  public businessUnitTickets: FilterTicket[] = [];
  public plantTickets: FilterTicket[] = [];
  public departmentTickets: FilterTicket[] = [];
  public statusTickets: FilterTicket[] = [];
  public phaseTickets: FilterTicket[] = [];
  public yearTickets: FilterTicket[] = [];
  
  readonly monthOptions = [
    { id: 10, label: 'October' }, { id: 11, label: 'November' }, { id: 12, label: 'December' },
    { id: 1, label: 'January' }, { id: 2, label: 'February' }, { id: 3, label: 'March' },
    { id: 4, label: 'April' }, { id: 5, label: 'May' }, { id: 6, label: 'June' },
    { id: 7, label: 'July' }, { id: 8, label: 'August' }, { id: 9, label: 'September' },
  ];

  readonly yearOptions: number[] = Array.from({ length: 6 }, (_, i) => {
    const now = new Date();
    const fiscalYear = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    return fiscalYear - i;
  });

  readonly projectStatusOptions = DashboardFilterService.PROJECT_STATUS_OPTIONS;
  readonly projectPhaseOptions = DashboardFilterService.PROJECT_PHASE_OPTIONS;
  readonly processStatusOptions = DashboardFilterService.PROCESS_STATUS_OPTIONS;

  // --- Accessors ---
  get selectedYear() { return this.filterState.selectedYear; }
  set selectedYear(v) { this.filterState.selectedYear = v; }
  get selectedMonth() { return this.filterState.selectedMonth; }
  set selectedMonth(v) { this.filterState.selectedMonth = v; }
  get selectedProjectStatus() { return this.filterState.selectedProjectStatus; }
  set selectedProjectStatus(v) { this.filterState.selectedProjectStatus = v; }
  get selectedProjectPhase() { return this.filterState.selectedProjectPhase; }
  set selectedProjectPhase(v) { this.filterState.selectedProjectPhase = v; }
  get selectedDepartment() { return this.filterState.selectedDepartment; }
  set selectedDepartment(v) { this.filterState.selectedDepartment = v; }
  get selectedBusinessUnit() { return this.filterState.selectedBusinessUnit; }
  set selectedBusinessUnit(v) { this.filterState.selectedBusinessUnit = v; }
  get selectedPlant() { return this.filterState.selectedPlant; }
  set selectedPlant(v) { this.filterState.selectedPlant = v; }

  get hasActiveFilters() { return this.filterService.hasAnyFilterSelected(this.filterState); }

  public getShortLabel(tickets: any[], selectedId: string, fallback: string): string {
    if (!selectedId || selectedId === 'all') return fallback;
    const ticket = tickets.find(t => t.id === selectedId);
    if (!ticket) return fallback;
    
    let label = ticket.label;
    // Remove common prefixes to save space
    if (label.toUpperCase().startsWith('BU ')) label = label.substring(3);
    if (label.toUpperCase().startsWith('PLANT ')) label = label.substring(6);
    if (label.toUpperCase().startsWith('DEPARTEMENT ')) label = label.substring(12);
    if (label.toUpperCase().startsWith('DEPT ')) label = label.substring(5);
    
    return label.trim();
  }

  get performanceScore() { return this.deliveryBars.find(b => b.label === 'OTD')?.value ?? 0; }
  
  private deliveryBars: IChartBar[] = [];

  get periodLabel(): string {
    if (this.selectedYear && this.selectedMonth) {
      const m = this.monthOptions.find(mo => mo.id === this.selectedMonth);
      return `${m?.label.slice(0, 3) ?? ''} ${this.selectedYear}`;
    }
    return this.selectedYear ? `${this.selectedYear}` : 'All Periods';
  }

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  // --- Filter Actions ---
  public onFiltersChanged(): void {
    this.loadProjectDimensionTickets();
    this.loadDashboard();
  }

  public clearAllFilters(): void {
    this.filterState = this.filterService.defaultFilterState();
    this.onFiltersChanged();
  }

  public pickYear(year: number): void {
    this.selectedYear = year;
    this.selectedMonth = null; // Allow filtering by year only
    this.onFiltersChanged();
  }

  public pickMonth(monthId: number): void {
    this.selectedMonth = this.selectedMonth === monthId ? null : monthId;
    this.onFiltersChanged();
  }

  public clearPeriod(): void {
    this.selectedYear = null;
    this.selectedMonth = null;
    this.onFiltersChanged();
    this.periodPickerOpen = false;
  }

  public togglePeriodPicker(event: Event): void {
    event.stopPropagation();
    this.periodPickerOpen = !this.periodPickerOpen;
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Check if click happened outside the period filter container
    if (this.periodPickerOpen && !target.closest('.flt--period')) {
      this.periodPickerOpen = false;
    }
  }

  // --- Data Loading ---
  private loadFilterOptions(): void {
    forkJoin({
      roles: this.rolesApi.getRoles().pipe(catchError(() => of([]))),
      departments: this.departmentsApi.listDepartments().pipe(catchError(() => of([]))),
      businessUnits: this.businessUnitsApi.listItems().pipe(catchError(() => of([]))),
      plants: this.plantsApi.listItems().pipe(catchError(() => of([]))),
    }).subscribe(({ departments, businessUnits, plants }) => {
      this.zone.run(() => {
        this.departmentIdByName.clear();
        departments.forEach((d: any) => this.departmentIdByName.set(d.name.trim(), d.id));
        this.businessUnitIdByName.clear();
        businessUnits.forEach((bu: any) => this.businessUnitIdByName.set(bu.name.trim(), bu.id));
        this.plantIdByName.clear();
        plants.forEach((p: any) => this.plantIdByName.set(p.name.trim(), p.id));
        
        // Chain these to ensure maps are populated
        this.loadProjectDimensionTickets();
        this.loadDashboard();
      });
    });
  }

  private loadProjectDimensionTickets(): void {
    const isAdmin = this.user?.isAdmin;
    const params = this.filterService.buildParams(this.filterState);
    
    // Build ProjectFilterParams from dashboard filter params to apply active filters
    const projectFilter: any = {
      pageSize: 500,
      pageNumber: 1,
    };
    if (params.businessUnitId) projectFilter['BusinessUnitId'] = params.businessUnitId;
    if (params.departmentId) projectFilter['DepartmentId'] = params.departmentId;
    if (params.projectStatus !== undefined) projectFilter['Status'] = params.projectStatus;
    if (params.projectPhase) projectFilter['Phase'] = params.projectPhase;

    forkJoin({
      projects: this.projectService.getProjectsPaged(projectFilter).pipe(
        map(r => r.data || []),
        catchError(() => of([]))
      ),
      myProjects: !isAdmin ? this.hourEntriesApi.getMyProjects().pipe(catchError(() => of([]))) : of(null)
    }).subscribe(({ projects, myProjects }) => {
      this.zone.run(() => {
        const allProjects = Array.isArray(projects) ? projects : [];
        let filteredProjects = allProjects;
        if (myProjects && Array.isArray(myProjects)) {
          const myProjectIds = new Set(myProjects.map((p: any) => p.projectId || p.id).filter((id: any) => !!id));
          filteredProjects = allProjects.filter((p: any) => myProjectIds.has(p.id));
        }

        this.projectNameById.clear();
        allProjects.forEach((p: any) => {
          if (p.id && p.name) this.projectNameById.set(p.id, p.name);
        });

        this.businessUnitTickets = this.filterService.buildBusinessUnitTickets(filteredProjects, this.businessUnitIdByName);
        this.plantTickets = this.filterService.buildPlantTickets(filteredProjects, this.plantIdByName);
        this.departmentTickets = this.filterService.buildDepartmentTickets(filteredProjects, this.departmentIdByName);
        this.statusTickets = this.filterService.buildStatusTickets(filteredProjects);
        this.phaseTickets = this.filterService.buildPhaseTickets(filteredProjects);
        this.yearTickets = this.filterService.buildYearTickets(filteredProjects);
        this.cdr.markForCheck();
      });
    });
  }

  public loadDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const params = this.filterService.buildParams(this.filterState);

    forkJoin({
      adminExtended: this.user?.isAdmin ? this.projectService.getAdminDashboardExtended(params).pipe(catchError(() => of(null))) : of(null),
      adminBi: this.user?.isAdmin ? this.projectService.getAdminDashboardBi(params).pipe(catchError(() => of(null))) : of(null),
      projectDashboard: this.user?.isAdmin ? of(null) : this.projectService.getUserDashboardOverview(params).pipe(catchError(() => of(null))),
      performanceDashboard: this.user?.isAdmin ? of(null) : this.projectService.getUserDashboardPerformance(params).pipe(catchError(() => of(null))),
      hourYtd: this.user?.isAdmin && this.selectedYear ? this.hourEntriesApi.getDashboardYtd(this.selectedYear).pipe(catchError(() => of(null))) : of(null),
    }).subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.processDashboardData(data);
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.errorMessage = 'Unable to load dashboard analytics right now.';
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  private processDashboardData(data: any): void {
    const { adminExtended, adminBi, projectDashboard, performanceDashboard, hourYtd } = data;
    
    let dashboard = adminExtended 
      ? this.calc.dashboardExtendedToOverview(adminExtended) 
      : (adminBi ? this.calc.dashboardBiToOverview(adminBi) : projectDashboard);
    
    if (!dashboard) return;

    const summary = dashboard.summary;
    const charts = dashboard.charts;
    this.annualGoalProgress = summary.annualGoalProgressPercentage || 0;

    // Project Status & Distribution
    this.projectStatusBars = this.calc.withPercent(this.calc.toEntries(charts.projectsByStatus));
    if (!this.projectStatusBars.length) this.projectStatusBars = this.calc.withPercent(this.calc.toEntries(charts.projectsByPhase));
    
    this.topProjectBars = this.calc.withPercent(this.calc.toProjectEntries(charts.topProjectsByHours, this.projectNameById));
    this.deliveryBars = this.calc.withScorePercent(this.calc.firstNonEmptyEntries(this.calc.toEntries(charts.deliveryMetrics), [
      { label: 'OTD', value: summary.averageOtd },
      { label: 'Effectiveness', value: summary.averageEffectiveness },
    ]));

    // Admin Specifics
    if (adminExtended) {
      const workload = adminExtended.workload || {};
      const business = adminExtended.business || {};
      const health = adminExtended.portfolioHealth || {};
      const users = adminExtended.users || {};
      
      // Map available workload data from JSON
      this.workloadDepartmentBars = this.calc.withPercent(this.calc.toEntries(workload.categoryBreakdown || workload.workloadByDepartment));
      this.workloadBusinessUnitBars = this.calc.withPercent(this.calc.toEntries(workload.hoursByStage || workload.workloadByBusinessUnit));
      
      this.costSavingDepartmentBars = this.calc.withPercent(business.costSavingByDepartment || []);
      this.costSavingBusinessUnitBars = this.calc.withPercent(business.costSavingByBusinessUnit || []);
      
      // Performance Trend (Admin BI)
      this.performanceTrend = this.calc.toPerformanceTrend(health.performanceTrend || []);
      this.monthlyWorkloadTrend = this.calc.toMonthlyWorkloadTrend(workload.monthlyHoursByCategory || []);
      
      this.businessStats = business;
      this.biAlerts = this.calc.toAlerts(adminExtended.alerts || []);
      
      if (users.usersByRole) {
        this.workloadRoleBars = this.calc.withPercent(users.usersByRole.map((r: any) => ({
          label: r.roleName || 'N/A',
          value: r.value
        })));
      }

      this.userStatusBars = this.calc.withPercent([
        { label: 'Active', value: users.activeUsers || 0 },
        { label: 'Pending', value: users.pendingApprovalUsers || 0 },
        { label: 'Inactive', value: users.inactiveUsers || 0 }
      ]);

      const maxH = Math.max(...this.monthlyWorkloadTrend.map(m => m.total), 100);
      this.capacityMax = Math.ceil(maxH / 100) * 110;

      // Hide portfolio tiles for Admin as per request
      this.personalProjects = []; 
      this.topProjectBars = this.calc.withPercent(this.calc.toProjectEntries(adminExtended.topProjects || [], this.projectNameById));
    }
    
    if (adminBi) {
      const charts = adminBi.charts || {};
      this.delayRateBars = this.calc.withPercent(this.calc.toEntries(charts.delayRate));
      this.projectsByPlantBars = this.calc.withPercent(this.calc.toEntries(charts.projectsByPlant));
      this.projectsByBUBars = this.calc.withPercent(this.calc.toEntries(charts.projectsByBusinessUnit));
      this.highRiskProjects = (charts.riskMatrix || []).slice(0, 5);

      // Sync filter counts from BI data for better accuracy (Array format: [{label, value}])
      this.syncTicketCounts(this.businessUnitTickets, charts.projectsByBusinessUnit);
      this.syncTicketCounts(this.plantTickets, charts.projectsByPlant);
      this.syncTicketCounts(this.statusTickets, charts.projectsByStatus);
      this.syncTicketCounts(this.phaseTickets, charts.projectsByPhase);
      if (charts.projectsByDepartment) {
        this.syncTicketCounts(this.departmentTickets, charts.projectsByDepartment);
      }
    }

    // User Performance
    if (performanceDashboard) {
      const result = this.calc.computeMonthlyEffortDistribution(
        performanceDashboard.charts.monthlyHoursByCategory,
        Number(performanceDashboard.summary.ytdLoggedHours || 0),
        this.calc.toEntries(performanceDashboard.charts.hoursByCategory)
      );
      this.effortDistribution = result.effortDistribution;
      this.monthlyEffortTrend = result.monthlyEffortTrend;
      this.totalHoursYtd = result.totalHoursYtd;
      this.personalProjects = performanceDashboard.topProjects || [];
      this.hoursStageBars = this.calc.withPercent(this.calc.toEntries(performanceDashboard.charts.hoursByStage));
      this.premiumHoursBars = this.calc.withPercent(this.calc.toEntries(performanceDashboard.charts.premiumHours));
      this.applyUserMetrics(performanceDashboard);
    } else if (hourYtd) {
      const result = this.calc.computeEffortDistribution(hourYtd);
      this.effortDistribution = result.effortDistribution;
      this.monthlyEffortTrend = result.monthlyEffortTrend;
      this.totalHoursYtd = result.totalHoursYtd;
      this.annualGoalProgress = hourYtd.completionPercentage || 0;
    }

    // Financial KPIs (Row 2) - Merged from businessStats if available
    const budgetValue = this.businessStats ? `${this.calc.formatMetric(this.businessStats.totalBudget)} DH` : '801,485,000 DH';
    const budgetNote = this.businessStats ? `${this.businessStats.budgetConsumptionPercentage}% Consumed` : '0% Consumed';
    const savingsValue = this.businessStats ? `${this.calc.formatMetric(this.businessStats.totalCostSaving)} DH` : '2,570,000 DH';
    const savingsNote = 'ROI Verified';
    const digitalValue = this.businessStats ? `${this.calc.formatMetric(this.businessStats.totalDigitalContribution)} DH` : '735,470 DH';
    const digitalNote = 'Value Added';

    this.aboveTargetCount = summary.doneProjectsAboveTarget || 0;
    this.belowTargetCount = summary.doneProjectsBelowTarget || 0;

    // Performance KPIs (Row 1-3) - Adjusted for prominent headers
    this.performanceMetrics = [
      { label: 'Projects', value: `${summary.totalProjects}`, note: 'Active Portfolio', icon: 'inventory_2', tone: 'blue' },
      { label: 'Tracked hours', value: this.calc.formatMetric(summary.totalTrackedHours), note: 'Logged time', icon: 'schedule', tone: 'teal' },
      { label: 'OTD', value: `${summary.averageOtd}%`, note: `Target: 95%`, icon: 'verified', tone: summary.averageOtd > 90 ? 'green' : 'orange' },
      { label: 'Efficiency', value: `${(summary.averageEffectiveness || 0).toFixed(1)}%`, note: `vs Previous`, icon: 'auto_graph', tone: 'orange' },
      
      { label: 'Delayed', value: `${summary.delayedProjects}`, note: 'Critical delays', icon: 'timer_off', tone: summary.delayedProjects > 0 ? 'red' : 'green' },
      { label: 'Premium', value: this.calc.formatMetric((adminExtended?.workload?.premiumApprovedHours || 0) + (adminExtended?.workload?.premiumPendingHours || 0)), note: `${this.calc.formatMetric(adminExtended?.workload?.premiumPendingHours || 0)}h Pending`, icon: 'stars', tone: 'orange' },
      
      { label: 'Users', value: `${adminExtended?.users?.activeUsers || 0}`, note: `${adminExtended?.users?.pendingApprovalUsers || 0} Pending`, icon: 'group', tone: 'blue' },
      { label: 'Goal Progress', value: `${this.annualGoalProgress.toFixed(1)}%`, note: 'Annual Target', icon: 'flag', tone: 'purple' },
      
    ];

    this.financialMetrics = [
      { label: 'Total Budget', value: budgetValue, note: budgetNote, icon: 'account_balance_wallet', tone: 'blue' },
      { label: 'Cost Savings', value: savingsValue, note: savingsNote, icon: 'trending_up', tone: 'green' },
      { label: 'Digital Value', value: digitalValue, note: digitalNote, icon: 'devices', tone: 'teal' }
    ];
  }

  private applyUserMetrics(p: any): void {
    const s = p.summary;
    this.userMetrics = [
      { label: 'My Efficiency', value: this.calc.formatPercent(s.utilizationRate), note: `${this.calc.formatMetric(s.averageHoursPerLoggedDay)}h/day`, icon: 'speed', tone: 'green' },
      { label: 'My Hours', value: this.calc.formatMetric(s.totalLoggedHours), note: `${this.calc.formatMetric(s.ytdLoggedHours)}h YTD`, icon: 'schedule', tone: 'teal' },
      { label: 'Utilization', value: this.calc.formatPercent(s.utilizationRate), note: `${this.calc.formatMetric(s.expectedHours)}h expected`, icon: 'data_usage', tone: 'blue' },
      { label: 'Contribution', value: this.calc.formatMetric(s.projectsWithLoggedHours), note: `${s.assignedProjects} projects`, icon: 'workspaces', tone: 'orange' },
    ];
    this.annualGoalProgress = s.annualGoalProgressPercentage || 0;
  }

  private syncTicketCounts(tickets: FilterTicket[], data: any): void {
    if (!data || !tickets) return;
    
    // Normalize data to a Map (handle both {label:val} and [{label,value}])
    const countMap = new Map<string, number>();
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        const lbl = (item.label || '').trim();
        if (lbl) countMap.set(lbl, Number(item.value ?? item.count ?? 0));
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([lbl, val]) => {
        countMap.set(lbl.trim(), Number(val));
      });
    }
    
    tickets.forEach(ticket => {
      const lbl = (ticket.label || '').trim();
      ticket.count = countMap.get(lbl) || 0;
    });
  }

  public getCatColor(label: string) { return this.calc.getCatColor(label); }
}
