import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UsersApiService, AdminUserDto } from '../../../../core/services/users-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectService } from '../../../projects/services/project';
import { InternsApiService, InternDto } from '../../../../core/services/interns-api.service';
import { HourEntriesApiService } from '../../../../core/services/hour-entries-api.service';
import { HourEntryDto } from '../../../../core/models/hour-entry.model';
import { BreadcrumbService } from '../../../../core/services/breadcrumb.service';
import { DashboardCalculationService, MetricCard, ChartBar } from '../../../dashboard/services/dashboard-calculation.service';
import { DashboardPerformanceDto, ProjectSummaryDto, DashboardFilterParams } from '../../../projects/models';
import { MetricCardComponent } from '../../../dashboard/components/metric-card/metric-card.component';
import { ChartBarComponent } from '../../../dashboard/components/chart-bar/chart-bar.component';
import { InternDetailsDialog } from '../../components/intern-details-dialog/intern-details-dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

@Component({
  selector: 'app-user-detail',
  standalone: false,
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly usersApi = inject(UsersApiService);
  private readonly projectService = inject(ProjectService);
  private readonly internsApi = inject(InternsApiService);
  private readonly hourEntriesApi = inject(HourEntriesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly calc = inject(DashboardCalculationService);
  private readonly notifications = inject(NotificationService);

  // --- State ---
  public isLoading = signal(true);
  public isFiltering = signal(false);
  public error = signal<string | null>(null);
  public userId = signal<string | null>(null);

  // --- Filter State ---
  public range = new FormGroup({
    start: new FormControl<Date | null>(new Date(new Date().getFullYear(), 0, 1)), // Jan 1st
    end: new FormControl<Date | null>(new Date())
  });

  public currentFilters = signal<DashboardFilterParams>({
    projectId: undefined
  });

  // --- Data ---
  public user = signal<AdminUserDto | null>(null);
  public performance = signal<DashboardPerformanceDto | null>(null);
  public projects = signal<ProjectSummaryDto[]>([]);
  public interns = signal<InternDto[]>([]);
  public pendingPremium = signal<HourEntryDto[]>([]);
  public internProjectsMap = signal<Map<string, ProjectSummaryDto[]>>(new Map());

  // --- Derived Metrics ---
  public performanceMetrics = computed(() => {
    const perf = this.performance();
    if (!perf) return [];
    
    const s = perf.summary;
    return [
      { label: 'Utilization Rate', value: this.calc.formatPercent(s.utilizationRate), note: `${this.calc.formatMetric(s.averageHoursPerLoggedDay)}h/day avg`, icon: 'speed', tone: 'green', progress: s.utilizationRate } as MetricCard,
      { label: 'Logged Hours', value: this.calc.formatMetric(s.totalLoggedHours), note: `${this.calc.formatMetric(s.ytdLoggedHours)}h YTD`, icon: 'schedule', tone: 'teal' } as MetricCard,
      { label: 'Annual Goal', value: this.calc.formatPercent(s.annualGoalProgressPercentage), note: `${this.calc.formatMetric(s.expectedHours)}h target`, icon: 'flag', tone: 'blue', progress: s.annualGoalProgressPercentage } as MetricCard,
      { label: 'Work Days', value: String(s.loggedDays), note: 'Days with entries', icon: 'calendar_today', tone: 'orange' } as MetricCard,
      { label: 'Project Count', value: String(s.assignedProjects), note: `${s.projectsWithLoggedHours} active projects`, icon: 'assignment', tone: 'purple' } as MetricCard,
      { label: 'Late Projects', value: String(s.delayedAssignedProjects), note: 'Needs attention', icon: 'error_outline', tone: s.delayedAssignedProjects > 0 ? 'red' : 'green' } as MetricCard,
      { label: 'Premium Hours', value: this.calc.formatMetric(s.premiumApprovedHours), note: `${s.premiumPendingHours}h pending`, icon: 'stars', tone: 'teal' } as MetricCard,
      { label: 'Total Cost', value: `${s.totalCost.toLocaleString()} DH`, note: 'Labor cost estimated', icon: 'payments', tone: 'blue' } as MetricCard,
    ];
  });

  public workloadTrend = computed(() => {
    const perf = this.performance();
    if (!perf || !perf.charts.monthlyHoursByCategory) return [];
    return perf.charts.monthlyHoursByCategory.map(m => ({
      label: m.monthName,
      value: m.totalHours,
      percent: 0 // Will be calculated by withPercent
    }));
  });

  public workloadTrendChart = computed(() => {
    return this.calc.withPercent(this.workloadTrend());
  });

  public periodLabel = computed(() => {
    const r = this.range.value;
    if (!r || !r.start || !r.end) return 'All Periods';
    
    const start = r.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = r.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // If it covers the whole year or is too wide, maybe 'All Periods'
    // But for now, just show the range
    return `${start} - ${end}`;
  });

  public projectLabel = computed(() => {
    const pid = this.currentFilters().projectId;
    if (!pid) return 'All Projects';
    const p = this.projects().find(x => x.id === pid);
    return p ? p.name : 'All Projects';
  });

  public effortDistribution = computed(() => {
    const perf = this.performance();
    if (!perf) return [];
    const entries = this.calc.toEntries(perf.charts.hoursByCategory);
    const total = entries.reduce((acc, e) => acc + e.value, 0);
    
    return entries.map(e => ({
      ...e,
      percent: total > 0 ? Number(((e.value / total) * 100).toFixed(2)) : 0
    }));
  });

  public stageWorkload = computed(() => {
    const perf = this.performance();
    if (!perf) return [];
    return this.calc.withPercent(this.calc.toEntries(perf.charts.hoursByStage));
  });

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.userId.set(id);
        this.loadAllData(id);
      }
    });

    // Listen to range changes
    this.range.valueChanges.subscribe(val => {
      if (val.start && val.end) {
        this.reloadPerformance();
      }
    });
  }

  private loadAllData(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filters = this.getFilters();

    forkJoin({
      userDetails: this.usersApi.getUser(id).pipe(catchError(() => of(null))),
      performance: this.projectService.getAdminUserPerformance(id, filters).pipe(catchError(() => of(null))),
      projects: this.projectService.getProjectsPaged({ UserId: id, pageSize: 100 }).pipe(
        map((res: any) => res.data || []),
        catchError(() => of([]))
      ),
      interns: this.internsApi.getInternsBySupervisor(id).pipe(catchError(() => of([]))),
      pendingPremium: this.hourEntriesApi.getPremiumPending().pipe(catchError(() => of([])))
    }).subscribe({
      next: (data) => {
        if (data.userDetails) {
          this.user.set(data.userDetails);
          this.breadcrumbService.setLabel(id, `${data.userDetails.firstName} ${data.userDetails.lastName}`);
        }
        this.performance.set(data.performance);
        this.projects.set(data.projects);
        this.interns.set(data.interns);
        
        // Filter pending premium hours for this specific user
        const userPending = data.pendingPremium.filter(h => h.userId === id);
        this.pendingPremium.set(userPending);

        // If there are interns, load their projects too
        if (data.interns.length > 0) {
          this.loadInternsProjects(data.interns);
        }
      },
      error: (err) => {
        this.error.set('Failed to load user details.');
        console.error(err);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  private getFilters(): DashboardFilterParams {
    const f = this.currentFilters();
    const r = this.range.value;
    
    return {
      ...f,
      startDate: r.start ? r.start.toISOString() : undefined,
      endDate: r.end ? r.end.toISOString() : undefined
    };
  }

  public updateFilter(key: keyof DashboardFilterParams, value: any): void {
    this.currentFilters.update(f => ({ ...f, [key]: value }));
    this.reloadPerformance();
  }

  private reloadPerformance(): void {
    const id = this.userId();
    if (!id) return;

    this.isFiltering.set(true);
    const filters = this.getFilters();

    this.projectService.getAdminUserPerformance(id, filters).pipe(
      finalize(() => this.isFiltering.set(false)),
      catchError(() => of(null))
    ).subscribe(perf => {
      this.performance.set(perf);
    });
  }

  private loadInternsProjects(interns: InternDto[]): void {
    const requests = interns.reduce((acc, intern) => {
      acc[intern.id] = this.projectService.getProjectsPaged({ InternId: intern.id, pageSize: 50 }).pipe(
        map((res: any) => res.data || []),
        catchError(() => of([]))
      );
      return acc;
    }, {} as Record<string, Observable<ProjectSummaryDto[]>>);

    forkJoin(requests).subscribe((results: Record<string, ProjectSummaryDto[]>) => {
      const map = new Map<string, ProjectSummaryDto[]>();
      Object.entries(results).forEach(([id, projs]) => map.set(id, projs));
      this.internProjectsMap.set(map);
    });
  }

  public openInternDetails(intern: InternDto): void {
    const internProjs = this.internProjectsMap().get(intern.id) || [];
    const projectIds = internProjs.map(p => p.id);

    this.dialog.open(InternDetailsDialog, {
      data: { intern, projectIds },
      panelClass: 'pm-dialog-panel'
    });
  }

  public handlePremiumDecision(entryId: string, isApproved: boolean): void {
    if (!isApproved) {
      const data: ConfirmationDialogData = {
        title: 'Reject Premium Request',
        message: 'Are you sure you want to reject this premium hour request? The hours will remain logged but will not be considered premium.',
        icon: 'cancel_presentation',
        saveLabel: 'Reject Request',
        saveColor: 'warn',
        cancelLabel: 'Go Back'
      };

      const dialogRef = this.dialog.open(ConfirmationDialog, {
        data,
        width: '400px'
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result === 'save') {
          this.executePremiumDecision(entryId, false);
        }
      });
    } else {
      this.executePremiumDecision(entryId, true);
    }
  }

  private executePremiumDecision(hourEntryId: string, isApproved: boolean): void {
    this.isFiltering.set(true);
    this.hourEntriesApi.approvePremium({ hourEntryId, isApproved }).subscribe({
      next: () => {
        this.notifications.showSuccess(isApproved ? 'Premium approved' : 'Premium rejected');
        this.reloadPerformance();
      },
      error: (err) => {
        console.error('Failed to apply premium decision', err);
        this.notifications.showError('Unable to process premium decision');
        this.isFiltering.set(false);
      }
    });
  }

  public getCatColor(label: string): string {
    return this.calc.getCatColor(label);
  }
}
