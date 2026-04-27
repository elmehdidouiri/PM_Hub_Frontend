import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Role, User } from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth';
import { DepartmentsApiService } from '../../../../core/services/departments-api.service';
import { HourEntriesApiService } from '../../../../core/services/hour-entries-api.service';
import { RolesApiService } from '../../../../core/services/roles-api.service';
import { DashboardFilterParams, DashboardStatsDto } from '../../../projects/models';
import { ProjectService } from '../../../projects/services/project';
import { YtdDashboardDto } from '../../../../core/models/hour-entry.model';

interface MetricCard {
  label: string;
  value: string;
  note: string;
  icon: string;
}

interface ChartBar {
  label: string;
  value: number;
  percent: number;
}

interface FilterTicket {
  id: string;
  label: string;
  count: number;
}

interface StatusMeta {
  id: string;
  label: string;
  apiValue?: string;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: false,
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.scss'],
})
export class DashboardHome implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly hourEntriesApi = inject(HourEntriesApiService);
  private readonly rolesApi = inject(RolesApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly projectNameById = new Map<string, string>();

  readonly user: User | null = this.authService.getCurrentUser();

  public isLoading = true;
  public errorMessage = '';
  public emptyFilterMessage = '';
  public effortDistribution: ChartBar[] = [];
  public monthlyEffortTrend: any[] = [];
  public totalHoursYtd: number = 0;
  public selectedYear: number | null = null;
  public selectedMonth: number | null = null;
  public selectedRoleId: string = 'all';
  public selectedProjectStatus: string = 'all';
  public selectedProjectPhase: string = 'all';
  public selectedProcessStatus: string = 'all';
  public selectedDepartment: string = 'all';
  public selectedBusinessUnit: string = 'all';
  public selectedPlant: string = 'all';

  readonly monthOptions = [
    { id: 1, label: 'January' },
    { id: 2, label: 'February' },
    { id: 3, label: 'March' },
    { id: 4, label: 'April' },
    { id: 5, label: 'May' },
    { id: 6, label: 'June' },
    { id: 7, label: 'July' },
    { id: 8, label: 'August' },
    { id: 9, label: 'September' },
    { id: 10, label: 'October' },
    { id: 11, label: 'November' },
    { id: 12, label: 'December' },
  ];

  readonly yearOptions: number[] = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  public roleOptions: Array<{ id: string; label: string }> = [{ id: 'all', label: 'All roles' }];
  public departmentOptions: Array<{ id: string; label: string }> = [{ id: 'all', label: 'All departments' }];
  public businessUnitTickets: FilterTicket[] = [];
  public plantTickets: FilterTicket[] = [];
  public departmentTickets: FilterTicket[] = [];
  public statusTickets: FilterTicket[] = [];
  public yearTickets: FilterTicket[] = [];

  readonly projectStatusOptions: StatusMeta[] = [
    { id: 'all', label: 'All Statuses' },
    { id: 'planned', label: 'Planned', apiValue: 'Planned' },
    { id: 'ongoing', label: 'Ongoing', apiValue: 'Ongoing' },
    { id: 'onhold', label: 'On Hold', apiValue: 'OnHold' },
    { id: 'done', label: 'Done', apiValue: 'Done' },
    { id: 'cancelled', label: 'Cancelled', apiValue: 'Cancelled' },
    { id: 'pipeline', label: 'Pipeline', apiValue: 'Pipeline' },
  ];

  readonly projectPhaseOptions = [
    { id: 'all', label: 'All phases' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'preprocess', label: 'Pre Process' },
    { id: 'initiation', label: 'Initiation' },
    { id: 'planification', label: 'Planification' },
    { id: 'execution', label: 'Execution' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'closing', label: 'Closing' },
  ];

  readonly processStatusOptions = [
    { id: 'all', label: 'All process statuses' },
    { id: 'notstarted', label: 'Not Started' },
    { id: 'asis', label: 'As-Is Process Understanding' },
    { id: 'tobe', label: 'To-Be Process Definition' },
    { id: 'onhold', label: 'On Hold' },
    { id: 'completed', label: 'Completed' },
    { id: 'implemented', label: 'Implemented In PDM Link' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  public metrics: MetricCard[] = [];
  public projectStatusBars: ChartBar[] = [];
  public topProjectBars: ChartBar[] = [];
  public userRoleBars: ChartBar[] = [];
  public deliveryBars: ChartBar[] = [];
  public projectTeamRoleBars: ChartBar[] = [];
  public monthlyCategoryBars: ChartBar[] = [];
  public hoursStageBars: ChartBar[] = [];

  public userMetrics: MetricCard[] = [];
  public kpiMetrics: MetricCard[] = [];
  public hoursMetrics: MetricCard[] = [];

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadProjectDimensionTickets();
    this.loadDashboard();
  }

  public get firstName(): string {
    return this.user?.firstName || 'User';
  }

  public get fullName(): string {
    if (!this.user) {
      return 'PMHUB User';
    }
    return `${this.user.firstName} ${this.user.lastName}`.trim();
  }

  public get roleLabel(): string {
    if (this.user?.isAdmin) {
      return 'Administrator';
    }
    return this.user?.roleName || 'Collaborator';
  }

  public onFiltersChanged(): void {
    this.loadProjectDimensionTickets();
    this.loadDashboard();
  }

  public setYTD(): void {
    this.selectedYear = new Date().getFullYear();
    this.selectedMonth = null;
    this.onFiltersChanged();
  }

  public toggleYTD(): void {
    const currentYear = new Date().getFullYear();
    if (this.selectedYear === currentYear && !this.selectedMonth) {
      this.clearTimeFilters();
    } else {
      this.setYTD();
    }
  }

  public getCatColor(label: string): string {
    const map: Record<string, string> = {
      Execution: '#f47c00',
      Supervision: '#3b82f6',
      Process: '#10b981',
      Management: '#8b5cf6',
      'R&D': '#ec4899',
      Workshop: '#f59e0b',
      Other: '#64748b',
      Interns: '#06b6d4'
    };
    return map[label] || '#cbd5e1';
  }

  private processEffortDistribution(ytd: YtdDashboardDto): void {
    const categories = [
      { key: 'totalExecutionHours', label: 'Execution', color: '#f47c00' },
      { key: 'totalSupervisionHours', label: 'Supervision', color: '#3b82f6' },
      { key: 'totalProcessHours', label: 'Process', color: '#10b981' },
      { key: 'totalManagementHours', label: 'Management', color: '#8b5cf6' },
      { key: 'totalRAndDHours', label: 'R&D', color: '#ec4899' },
      { key: 'totalWorkshopHours', label: 'Workshop', color: '#f59e0b' },
      { key: 'totalOtherHours', label: 'Other', color: '#64748b' },
      { key: 'totalInternManagementHours', label: 'Interns', color: '#06b6d4' }
    ];

    const totals = categories.reduce((acc, cat) => ({ ...acc, [cat.label]: 0 }), {} as Record<string, number>);
    
    // 1. Calculate Grand Totals
    ytd.monthlyBreakdown?.forEach(m => {
      categories.forEach(cat => {
        const val = (m as any)[cat.key] || 0;
        totals[cat.label] += val;
      });
    });

    const entries = Object.entries(totals).map(([label, value]) => ({ label, value }));
    const totalHours = entries.reduce((s, e) => s + e.value, 0);
    this.totalHoursYtd = totalHours;

    this.effortDistribution = entries.map(e => ({
      ...e,
      percent: totalHours > 0 ? Math.round((e.value / totalHours) * 100) : 0
    })).sort((a, b) => b.value - a.value);

    // 2. Calculate Monthly Trend
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.monthlyEffortTrend = monthNames.map((name, idx) => {
      const monthData = ytd.monthlyBreakdown?.find(m => m.month === (idx + 1));
      const catData = categories.map(cat => ({
        label: cat.label,
        value: (monthData as any)?.[cat.key] || 0,
        color: cat.color
      }));
      const monthTotal = catData.reduce((s, c) => s + c.value, 0);
      
      return {
        monthName: name,
        total: monthTotal,
        categories: catData.map(c => ({
          ...c,
          percent: monthTotal > 0 ? (c.value / monthTotal) * 100 : 0
        }))
      };
    });
  }

  public clearTimeFilters(): void {
    this.selectedYear = null;
    this.selectedMonth = null;
    this.onFiltersChanged();
  }

  public selectStatusTicket(ticketId: string): void {
    this.selectedProjectStatus = ticketId;
    this.loadDashboard();
  }

  public selectYearTicket(yearStr: string): void {
    const year = parseInt(yearStr);
    this.selectedYear = this.selectedYear === year ? null : year;
    this.loadDashboard();
  }

  public selectDepartmentTicket(ticketId: string): void {
    this.selectedDepartment = this.selectedDepartment === ticketId ? 'all' : ticketId;
    this.loadDashboard();
  }

  public selectBusinessUnit(ticketId: string): void {
    this.selectedBusinessUnit = this.selectedBusinessUnit === ticketId ? 'all' : ticketId;
    this.loadDashboard();
  }

  public selectPlant(ticketId: string): void {
    this.selectedPlant = this.selectedPlant === ticketId ? 'all' : ticketId;
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.emptyFilterMessage = '';
    const params = this.buildDashboardFilters();

    const statsYear = this.selectedYear || new Date().getFullYear();

    forkJoin({
      projectStats: this.user?.isAdmin
        ? this.projectService.getAdminDashboardStatsFiltered(params)
        : this.projectService.getUserDashboardStatsFiltered(params),
      hourYtd: this.hourEntriesApi.getDashboardYtd(statsYear).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ projectStats, hourYtd }) => {
        this.zone.run(() => {
          const stats = projectStats;
          const dynamic = (stats as any) ?? {};
          const summary = this.toRecord(dynamic['summary']) ?? dynamic;
          const charts = this.toRecord(dynamic['charts']) ?? {};
          const totalProjects = Number(stats?.totalProjects ?? 0);
          const averageOtd = Number(stats?.averageOtd ?? 0);
          const averageEffectiveness = Number(stats?.averageEffectiveness ?? 0);

          if (hourYtd) {
            this.processEffortDistribution(hourYtd);
          }
          const delayedProjects = Number(stats?.delayedProjects ?? 0);
          const projectsByPhase = this.withPercent(this.toEntries(stats?.projectsByPhase));
          const topProjects = this.withPercent(this.toProjectEntries(dynamic['topProjectsByHours']));
          const usersByRole = this.withPercent(this.toEntries(dynamic['usersByRole']));
          const projectTeamRole = this.withPercent(
            this.firstNonEmptyEntries(
              this.toEntries(charts['projectTeamMembersByRole']),
              this.toEntries(dynamic['projectTeamMembersByRole']),
              this.toEntries(charts['teamMembersByRole']),
              this.toEntries(dynamic['teamMembersByRole'])
            )
          );
          const monthlyByCategory = this.withPercent(
            this.firstNonEmptyEntries(
              this.toEntries(charts['monthlyHoursBreakdownByCategory']),
              this.toEntries(dynamic['monthlyHoursBreakdownByCategory']),
              this.toEntries(charts['hoursByCategory']),
              this.toEntries(dynamic['hoursByCategory'])
            )
          );
          const hoursByStage = this.withPercent(
            this.firstNonEmptyEntries(
              this.toEntries(charts['hoursByStage']),
              this.toEntries(dynamic['hoursByStage']),
              this.toEntries(charts['hoursByEtape']),
              this.toEntries(dynamic['hoursByEtape']),
              this.toEntries(charts['hoursByType']),
              this.toEntries(dynamic['hoursByType'])
            )
          );

          const totalUsers = this.readNumber(summary, ['totalUsers', 'TotalUsers']);
          const activeUsers = this.readNumber(summary, ['activeUsers', 'ActiveUsers']);
          const activeMembers = this.readNumber(summary, ['activeMembers', 'ActiveMembers']);

          const kpiTargets = this.readNumber(summary, ['kpiTargets', 'KpiTargets']);
          const avgCsat = this.readNumber(summary, ['averageCsat', 'avgCsat', 'AVGCSAT']);

          const totalHoursYtd = this.readNumber(summary, ['totalHoursYtd', 'ytdHours', 'TotalHoursYtd']);
          const avgHours = this.readNumber(summary, ['averageHours', 'avgHours', 'AverageHours']);
          const avgUtilization = this.readNumber(summary, ['averageUtilization', 'avgUtilization', 'AVGUtilization']);

          const hasAnyFilter = this.hasAnyFilterSelected();
          const hasMatchingData =
            totalProjects > 0 ||
            projectsByPhase.length > 0 ||
            topProjects.length > 0 ||
            usersByRole.length > 0 ||
            projectTeamRole.length > 0 ||
            monthlyByCategory.length > 0 ||
            hoursByStage.length > 0;
          const noDataForFilters = hasAnyFilter && !hasMatchingData;

          this.projectStatusBars = projectsByPhase;
          this.topProjectBars = topProjects;
          this.userRoleBars = usersByRole;
          this.projectTeamRoleBars = projectTeamRole;
          this.monthlyCategoryBars = monthlyByCategory;
          this.hoursStageBars = hoursByStage;
          this.deliveryBars = this.withPercent([
            { label: 'OTD', value: averageOtd },
            { label: 'Effectiveness', value: averageEffectiveness },
          ]);

          this.metrics = [
            { label: 'Projects', value: `${totalProjects}`, note: 'Total projects in portfolio', icon: 'inventory_2' },
            { label: 'OTD', value: `${averageOtd.toFixed(1)}%`, note: 'On-time delivery rate', icon: 'speed' },
            { label: 'Effectiveness', value: `${averageEffectiveness.toFixed(1)}%`, note: 'Average project progress', icon: 'auto_graph' },
            { label: 'Delayed', value: `${delayedProjects}`, note: 'Projects currently delayed', icon: 'timer_off' },
          ];

          this.userMetrics = [
            { label: 'Total users', value: this.formatMetric(totalUsers), note: 'Registered users', icon: 'badge' },
            { label: 'Active users', value: this.formatMetric(activeUsers), note: 'Users active on platform', icon: 'person_search' },
            { label: 'Active members', value: this.formatMetric(activeMembers), note: 'Members active in teams', icon: 'diversity_3' },
          ];

          this.kpiMetrics = [
            { label: 'KPI targets', value: this.formatMetric(kpiTargets), note: 'Defined KPI target entries', icon: 'ads_click' },
            { label: 'AVG OTD', value: `${averageOtd.toFixed(1)}%`, note: 'Average on-time delivery', icon: 'verified' },
            { label: 'AVG Effectiveness', value: `${averageEffectiveness.toFixed(1)}%`, note: 'Average effectiveness index', icon: 'show_chart' },
            { label: 'AVG CSAT', value: this.formatPercent(avgCsat), note: 'Average project CSAT', icon: 'add_reaction' },
          ];

          this.hoursMetrics = [
            { label: 'Total hours YTD', value: this.formatMetric(this.totalHoursYtd), note: 'Year-to-date tracked hours', icon: 'history_toggle_off' },
            { label: 'AVG hours', value: this.formatMetric(avgHours), note: 'Average hours per period', icon: 'hourglass_empty' },
            { label: 'AVG utilization', value: this.formatPercent(avgUtilization), note: 'Platform utilization average', icon: 'data_exploration' },
          ];

          this.emptyFilterMessage = noDataForFilters
            ? 'No results found for the selected filters. Please adjust your filter criteria.'
            : '';

          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.errorMessage = 'Unable to load dashboard analytics right now.';
          this.metrics = [];
          this.projectStatusBars = [];
          this.userRoleBars = [];
          this.projectTeamRoleBars = [];
          this.topProjectBars = [];
          this.monthlyCategoryBars = [];
          this.hoursStageBars = [];
          this.userMetrics = [];
          this.kpiMetrics = [];
          this.hoursMetrics = [];
          this.deliveryBars = [];
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadFilterOptions(): void {
    forkJoin({
      roles: this.rolesApi.getRoles().pipe(catchError(() => of([] as Role[]))),
      departments: this.departmentsApi.listDepartments().pipe(catchError(() => of([]))),
    }).subscribe(({ roles, departments }) => {
      this.zone.run(() => {
        this.roleOptions = [
          { id: 'all', label: 'All roles' },
          ...roles.filter((r) => !!r.id && !!r.name).map((r) => ({ id: r.id, label: r.name })),
        ];

        this.departmentOptions = [
          { id: 'all', label: 'All departments' },
          ...departments
            .filter((d: any) => !!d.id && !!d.name)
            .map((d: any) => ({ id: d.id, label: d.name })),
        ];
        this.cdr.markForCheck();
      });
    });
  }

  private loadProjectDimensionTickets(): void {
    const filters = this.buildDashboardFilters();
    // We want to load the project list with the current filters to update the ticket counts
    // However, getProjectsPaged returns a PaginatedResponse, we might need all matching projects
    // to build accurate counts across all dimensions.
    
    // For now, let's use the paged endpoint with a large page size to get all filtered projects
    // or use a specialized summary endpoint if available.
    this.projectService
      .getProjectsPaged({ 
        PageSize: 2000, // Get enough projects to build counts
        Search: undefined,
        Status: this.selectedProjectStatus !== 'all' ? Number(this.toProjectStatusApiValue(this.selectedProjectStatus)) : undefined,
        // If year is selected, we should pass it to get filtered projects for the tickets
        // The getProjectsPaged might need update to support Year if backend supports it.
      })
      .pipe(catchError(() => of({ data: [] } as any)))
      .subscribe((response) => {
        this.zone.run(() => {
          const allProjects = Array.isArray(response.data) ? response.data : [];
          this.projectNameById.clear();
          for (const project of allProjects) {
            const projectRecord = project as unknown as Record<string, unknown>;
            const projectId = this.readString(projectRecord, ['id', 'projectId', 'Id']);
            const projectName = this.readString(projectRecord, ['name', 'projectName', 'Name', 'ProjectName']);
            if (projectId && projectName) {
              this.projectNameById.set(projectId, projectName);
            }
          }
          this.businessUnitTickets = this.buildBusinessUnitTickets(allProjects);
          this.plantTickets = this.buildPlantTickets(allProjects);
          this.departmentTickets = this.buildDepartmentTickets(allProjects);
          this.statusTickets = this.buildStatusTickets(allProjects);
          this.yearTickets = this.buildYearTickets(allProjects);
          this.cdr.markForCheck();
        });
      });
  }

  private buildDepartmentTickets(projects: any[]): FilterTicket[] {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const dept = (p.department || p.departmentName || 'Unknown').trim();
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ id: label, label, count }))
      .sort((a,b) => b.count - a.count);
  }

  private buildStatusTickets(projects: any[]): FilterTicket[] {
    const counts = new Map<string, number>();

    for (const p of projects) {
      const meta = this.getProjectStatusMeta(p.status || p.projectStatus || '');
      if (!meta) {
        continue;
      }

      counts.set(meta.id, (counts.get(meta.id) ?? 0) + 1);
    }

    const dynamicTickets = this.projectStatusOptions
      .filter((status) => status.id !== 'all')
      .map((status) => ({
        id: status.id,
        label: status.label,
        count: counts.get(status.id) ?? 0,
      }))
      .filter((status) => {
        if (status.count > 0) {
          return true;
        }

        return status.id !== 'cancelled' && status.id !== 'pipeline';
      });

    const unknownTickets = [...counts.entries()]
      .filter(([id]) => !this.projectStatusOptions.some((status) => status.id === id))
      .map(([id, count]) => ({
        id,
        label: this.toStatusLabel(id),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [
      { id: 'all', label: 'All Statuses', count: projects.length },
      ...dynamicTickets,
      ...unknownTickets,
    ];
  }

  private buildYearTickets(projects: any[]): FilterTicket[] {
    const counts = new Map<number, number>();
    for (const p of projects) {
       const year = p.year || (p.createdAt ? new Date(p.createdAt).getFullYear() : new Date().getFullYear());
       counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    return [...counts.entries()].map(([year, count]) => ({ id: year.toString(), label: year.toString(), count }))
      .sort((a,b) => b.label.localeCompare(a.label));
  }

  private buildDashboardFilters(): DashboardFilterParams {
    const projectPhaseMap: Record<string, string> = {
      pipeline: 'Pipeline',
      preprocess: 'PreProcess',
      initiation: 'Initiation',
      planification: 'Planification',
      execution: 'Execution',
      monitoring: 'Monitoring',
      closing: 'Closing',
    };
    const processStatusMap: Record<string, string> = {
      notstarted: 'NotStarted',
      asis: 'AsIs',
      tobe: 'ToBe',
      onhold: 'OnHold',
      completed: 'Completed',
      implemented: 'Implemented',
      cancelled: 'Cancelled',
    };

    return {
      year: this.selectedYear ?? undefined,
      month: this.selectedMonth ?? undefined,
      topN: 5,
      roleId: this.selectedRoleId !== 'all' ? this.selectedRoleId : undefined,
      departmentId: this.selectedDepartment !== 'all' ? this.selectedDepartment : undefined,
      businessUnitId: this.selectedBusinessUnit !== 'all' ? this.selectedBusinessUnit : undefined,
      plant: this.selectedPlant !== 'all' ? this.selectedPlant : undefined,
      projectStatus: this.selectedProjectStatus !== 'all' ? this.toProjectStatusApiValue(this.selectedProjectStatus) : undefined,
      projectPhase: this.selectedProjectPhase !== 'all' ? projectPhaseMap[this.selectedProjectPhase] : undefined,
      processStatus: this.selectedProcessStatus !== 'all' ? processStatusMap[this.selectedProcessStatus] : undefined,
    };
  }

  private getProjectStatusMeta(rawStatus: unknown): StatusMeta | null {
    const normalized = this.normalizeProjectStatusId(rawStatus);
    if (!normalized) {
      return null;
    }

    return this.projectStatusOptions.find((status) => status.id === normalized)
      ?? { id: normalized, label: this.toStatusLabel(normalized), apiValue: this.toProjectStatusApiValue(normalized) };
  }

  private normalizeProjectStatusId(rawStatus: unknown): string {
    const value = `${rawStatus ?? ''}`.trim().toLowerCase();
    if (!value) {
      return '';
    }

    if (value.includes('on hold') || value.includes('onhold')) {
      return 'onhold';
    }
    if (value.includes('ongoing') || value.includes('in progress')) {
      return 'ongoing';
    }
    if (value.includes('planned') || value.includes('plan')) {
      return 'planned';
    }
    if (value.includes('done') || value.includes('complete') || value.includes('completed')) {
      return 'done';
    }
    if (value.includes('cancel')) {
      return 'cancelled';
    }
    if (value.includes('pipeline')) {
      return 'pipeline';
    }

    return value.replace(/[\s_-]+/g, '');
  }

  private toProjectStatusApiValue(statusId: string): string {
    const knownStatus = this.projectStatusOptions.find((status) => status.id === statusId);
    if (knownStatus?.apiValue) {
      return knownStatus.apiValue;
    }

    return statusId
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part, index) => index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private toStatusLabel(statusId: string): string {
    const knownStatus = this.projectStatusOptions.find((status) => status.id === statusId);
    if (knownStatus?.label) {
      return knownStatus.label;
    }

    return statusId
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[\s_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private toEntries(source: unknown): Array<{ label: string; value: number }> {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            label: String(row['label'] ?? row['name'] ?? row['key'] ?? 'N/A'),
            value: Number(row['value'] ?? row['count'] ?? 0),
          };
        })
        .filter((item) => Number.isFinite(item.value) && item.value >= 0);
    }

    if (typeof source === 'object') {
      return Object.entries(source as Record<string, unknown>).map(([label, value]) => ({
        label,
        value: Number(value ?? 0),
      }));
    }

    return [];
  }

  private toProjectEntries(source: unknown): Array<{ label: string; value: number }> {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          const projectId = this.readString(row, ['projectId', 'id', 'Id']);
          const resolvedName = projectId ? this.projectNameById.get(projectId) ?? '' : '';

          return {
            label: String(
              row['label'] ??
              row['name'] ??
              row['projectName'] ??
              row['title'] ??
              resolvedName ??
              'N/A'
            ),
            value: Number(
              row['value'] ??
              row['count'] ??
              row['hours'] ??
              row['totalHours'] ??
              row['actualHours'] ??
              0
            ),
          };
        })
        .filter((item) => item.label !== 'N/A' && Number.isFinite(item.value) && item.value >= 0);
    }

    return this.toEntries(source);
  }

  private withPercent(entries: Array<{ label: string; value: number }>): ChartBar[] {
    const sanitized = entries.filter((item) => Number.isFinite(item.value) && item.value >= 0);
    const max = sanitized.reduce((acc, item) => Math.max(acc, item.value), 0);
    if (!max) {
      return sanitized.map((item) => ({ ...item, percent: 0 }));
    }
    return sanitized.map((item) => ({ ...item, percent: Math.max(6, (item.value / max) * 100) }));
  }

  private hasAnyFilterSelected(): boolean {
    return (
      this.selectedYear !== null ||
      this.selectedMonth !== null ||
      this.selectedRoleId !== 'all' ||
      this.selectedBusinessUnit !== 'all' ||
      this.selectedPlant !== 'all' ||
      this.selectedProjectStatus !== 'all' ||
      this.selectedProjectPhase !== 'all' ||
      this.selectedProcessStatus !== 'all' ||
      this.selectedDepartment !== 'all'
    );
  }

  private buildBusinessUnitTickets(projects: DashboardProjectLike[]): FilterTicket[] {
    const counts = new Map<string, number>();

    for (const project of projects) {
      const units = Array.isArray(project.businessUnits) ? project.businessUnits : [];
      for (const unit of units) {
        const key = `${unit}`.trim();
        if (!key) {
          continue;
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ id: label, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 20);
  }

  private buildPlantTickets(projects: DashboardProjectLike[]): FilterTicket[] {
    const counts = new Map<string, number>();

    for (const project of projects) {
      const plant = (project.plantName ?? project.PlantName ?? project.plant ?? project.Plant ?? '').trim();
      if (!plant) {
        continue;
      }
      counts.set(plant, (counts.get(plant) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ id: label, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 20);
  }

  private firstNonEmptyEntries(...candidates: Array<Array<{ label: string; value: number }>>): Array<{ label: string; value: number }> {
    for (const entries of candidates) {
      if (entries.length > 0) {
        return entries;
      }
    }
    return [];
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private readNumber(record: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private formatMetric(value: number | null): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toFixed(1).replace(/\.0$/, '');
  }

  private formatPercent(value: number | null): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return 'N/A';
    }
    return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  }
}

interface DashboardProjectLike {
  businessUnits?: string[];
  plantName?: string | null;
  PlantName?: string | null;
  plant?: string | null;
  Plant?: string | null;
}
