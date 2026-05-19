import { DashboardMetric } from '../../models/dashboard-metric.model';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { catchError, finalize, of } from 'rxjs';

import {
  HoursAllocationDashboardDto,
  HoursAllocationDashboardParams,
  HoursAllocationFiltersDto,
} from '../../models/hours-allocation-dashboard.models';
import { HoursAllocationDashboardService } from '../../services/hours-allocation-dashboard.service';

type QuickSelect = 'month' | 'year' | 'ytd';
type AnalysisMode = 'resourcesCapacity' | 'workedDays' | 'allocationDetails';

interface SummaryCard extends DashboardMetric {}

import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { LoadingService } from '../../../../shared/services/loading.service';

@Component({
  selector: 'app-hours-allocation-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, LoadingSpinner],
  templateUrl: './hours-allocation-dashboard.html',
  styleUrl: './hours-allocation-dashboard.scss',
})
export class HoursAllocationDashboard implements OnInit {
  private readonly service = inject(HoursAllocationDashboardService);
  private readonly loadingService = inject(LoadingService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly now = new Date();

  filters: HoursAllocationFiltersDto = this.emptyFilters();
  dashboard: HoursAllocationDashboardDto | null = null;
  isLoading = true;
  isRefreshing = false;
  isSendingReminders = false;
  showAdvancedFilters = false;
  errorMessage = '';
  successMessage = '';

  selectedUserId: string | null = null;
  selectedProjectId: string | null = null;
  selectedRoleId: string | null = null;
  selectedQuickSelect: QuickSelect = 'month';
  selectedAnalysis: AnalysisMode = 'resourcesCapacity';
  selectedYear = this.now.getFullYear();
  selectedMonth = this.now.getMonth() + 1;
  fromDate = this.toDateInputValue(new Date(this.now.getFullYear(), this.now.getMonth(), 1));
  toDate = this.toDateInputValue(new Date(this.now.getFullYear(), this.now.getMonth() + 1, 0));

  private latestRequest = 0;

  ngOnInit(): void {
    this.loadInitialData();
  }

  get summaryCards(): SummaryCard[] {
    const summary = this.dashboard?.summary;
    return [
      {
        label: 'Total Hours',
        value: this.formatHours(summary?.totalHours),
        note: String(this.selectedYear),
        icon: 'schedule',
        tone: 'orange',
      },
      {
        label: 'Active Users',
        value: this.formatNumber(summary?.activeUsers),
        note: 'Users with hours',
        icon: 'groups',
        tone: 'amber',
      },
      {
        label: 'Projects',
        value: this.formatNumber(summary?.projects),
        note: 'Active projects',
        icon: 'folder',
        tone: 'orange',
      },
      {
        label: 'Allocations',
        value: this.formatNumber(summary?.allocations),
        note: 'Allocation rows',
        icon: 'assignment',
        tone: 'amber',
      },
      {
        label: 'Avg Utilization',
        value: this.formatPercent(summary?.averageUtilization),
        note: 'Capacity usage',
        icon: 'trending_up',
        tone: 'green',
      },
      {
        label: 'Year-to-Date',
        value: this.formatHours(summary?.yearToDateHours),
        note: String(this.selectedYear),
        icon: 'calendar_today',
        tone: 'neutral',
      },
      {
        label: 'Avg Monthly',
        value: this.formatHours(summary?.averageMonthlyHours),
        note: `${this.dashboard?.monthlyBreakdown?.length ?? 0} months`,
        icon: 'equalizer',
        tone: 'neutral',
      },
    ];
  }

  get totalDetailedHours(): number {
    return this.dashboard?.details.reduce((total, item) => total + item.totalHours, 0) ?? 0;
  }

  get maxMonthHours(): number {
    return Math.max(1, ...(this.dashboard?.monthlyBreakdown ?? []).map((item) => item.totalHours));
  }

  get years(): number[] {
    const years = new Set<number>(this.filters.fiscalYears);
    for (let year = this.now.getFullYear() + 1; year >= this.now.getFullYear() - 5; year--) {
      years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }

  get months() {
    return this.filters.months.length ? this.filters.months : this.defaultMonths();
  }

  get headerPeriodLabel(): string {
    if (this.selectedQuickSelect === 'month') {
      const month = this.months.find((item) => item.value === this.selectedMonth);
      return `${month?.label ?? 'Month'} ${this.selectedYear}`;
    }

    if (this.selectedQuickSelect === 'year') {
      return `Year ${this.selectedYear}`;
    }

    return `YTD ${this.selectedYear}`;
  }

  get headerPeriodRange(): string {
    const from = this.formatHeaderDate(this.fromDate);
    const to = this.formatHeaderDate(this.toDate);
    return `${from} – ${to}`;
  }

  reload(): void {
    this.loadDashboard(false);
  }

  selectQuick(value: QuickSelect): void {
    this.selectedQuickSelect = value;

    if (value === 'month') {
      this.fromDate = this.toDateInputValue(new Date(this.selectedYear, this.selectedMonth - 1, 1));
      this.toDate = this.toDateInputValue(new Date(this.selectedYear, this.selectedMonth, 0));
    }

    if (value === 'year') {
      this.fromDate = `${this.selectedYear}-01-01`;
      this.toDate = `${this.selectedYear}-12-31`;
    }

    if (value === 'ytd') {
      this.fromDate = `${this.selectedYear}-01-01`;
      this.toDate = this.toDateInputValue(this.now);
    }

    this.reload();
  }

  onYearChanged(): void {
    this.selectQuick(this.selectedQuickSelect);
  }

  onMonthChanged(): void {
    this.selectedQuickSelect = 'month';
    this.selectQuick('month');
  }

  sendReminders(): void {
    this.isSendingReminders = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.service
      .sendReminders(this.buildParams())
      .pipe(
        finalize(() => {
          this.isSendingReminders = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Reminders sent successfully.';
        },
        error: () => {
          this.errorMessage = 'Unable to send reminders right now.';
        },
      });
  }

  trackById(_: number, item: { userId?: string; projectId?: string; roleId?: string; memberId?: string }): string {
    return item.userId || item.projectId || item.roleId || item.memberId || String(_);
  }

  trackByDate(_: number, item: { date: string; userId: string; projectId: string }): string {
    return `${item.date}-${item.userId}-${item.projectId}`;
  }

  trackByMonth(_: number, item: { year: number; month: number }): string {
    return `${item.year}-${item.month}`;
  }

  monthWidth(hours: number): number {
    return Math.max(0, Math.min(100, (Number(hours || 0) / this.maxMonthHours) * 100));
  }

  formatHours(value: unknown): string {
    return `${this.formatNumber(value)}h`;
  }

  formatNumber(value: unknown): string {
    const parsed = Number(value ?? 0);
    return new Intl.NumberFormat('en', {
      minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(parsed) ? parsed : 0);
  }

  formatPercent(value: unknown): string {
    const parsed = Number(value ?? 0);
    return `${Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0'}%`;
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.loadingService.show();
    this.errorMessage = '';

    this.service
      .getFilters()
      .pipe(catchError(() => of(this.emptyFilters())))
      .subscribe((filters) => {
        this.filters = this.normalizeFilters(filters);
        this.cdr.markForCheck();
      });

    this.loadDashboard(true);
  }

  private loadDashboard(initial: boolean): void {
    const requestId = ++this.latestRequest;
    this.isLoading = initial;
    this.isRefreshing = !initial;
    this.errorMessage = '';
    this.successMessage = '';

    this.service
      .getDashboard(this.buildParams())
      .pipe(
        finalize(() => {
          if (requestId === this.latestRequest) {
            this.isLoading = false;
            this.isRefreshing = false;
            this.loadingService.hide();
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (dashboard) => {
          if (requestId === this.latestRequest) {
            this.dashboard = dashboard;
          }
        },
        error: () => {
          if (requestId === this.latestRequest) {
            this.dashboard = null;
            this.errorMessage = 'Unable to load hours allocation with the selected filters.';
          }
        },
      });
  }

  private buildParams(): HoursAllocationDashboardParams {
    return {
      userId: this.selectedUserId,
      memberId: null,
      projectId: this.selectedProjectId,
      roleId: this.selectedRoleId,
      year: this.selectedYear,
      month: this.selectedQuickSelect === 'month' ? this.selectedMonth : null,
      fromDate: this.fromDate,
      toDate: this.toDate,
      quickSelect: this.selectedQuickSelect,
      analysis: this.selectedAnalysis,
    };
  }

  private normalizeFilters(filters: HoursAllocationFiltersDto): HoursAllocationFiltersDto {
    return {
      users: filters.users ?? [],
      projects: filters.projects ?? [],
      roles: filters.roles ?? [],
      members: filters.members ?? [],
      fiscalYears: filters.fiscalYears?.length ? filters.fiscalYears : this.years,
      months: filters.months?.length ? filters.months : this.defaultMonths(),
    };
  }

  private emptyFilters(): HoursAllocationFiltersDto {
    return {
      users: [],
      projects: [],
      roles: [],
      members: [],
      fiscalYears: [],
      months: this.defaultMonths(),
    };
  }

  private defaultMonths(): Array<{ value: number; label: string }> {
    return Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)),
    }));
  }

  private toDateInputValue(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private formatHeaderDate(value: string): string {
    if (!value) {
      return '—';
    }

    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value.toUpperCase();
    }

    return date
      .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      .toUpperCase();
  }
}
