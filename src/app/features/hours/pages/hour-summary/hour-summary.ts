import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { resolveMyProjectOption } from '../../../../core/models/hour-entry.model';
import { Hour } from '../../services/hour';

@Component({
  selector: 'app-hour-summary',
  standalone: false,
  templateUrl: './hour-summary.html',
  styleUrl: './hour-summary.scss',
})
export class HourSummary implements OnInit {
  private readonly hourService = inject(Hour);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentDate = new Date();
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

  readonly yearOptions = Array.from({ length: 6 }, (_, index) => this.currentDate.getFullYear() - 2 + index);

  readonly filtersForm = this.fb.nonNullable.group({
    year: [this.currentDate.getFullYear()],
    month: [this.currentDate.getMonth() + 1],
    projectId: [''],
  });

  projectOptions: Array<{ projectId: string; label: string }> = [];

  isLoading = true;
  isRefreshing = false;
  summaryError = '';

  monthlySummary: SummaryMetricCard[] = [];
  totalHoursCard: SummaryMetricCard | null = null;
  breakdownCards: BreakdownCard[] = [];
  topProjects: TopProjectCard[] = [];

  ngOnInit(): void {
    this.loadProjectsAndSummary();
  }

  get selectedMonthLabel(): string {
    return this.monthOptions.find((month) => month.value === this.filtersForm.controls.month.value)?.label ?? 'Current month';
  }

  get hasProjectFilter(): boolean {
    return this.projectOptions.length > 0;
  }

  refresh(): void {
    this.loadSummary(true);
  }

  private loadProjectsAndSummary(): void {
    this.hourService
      .myProjects()
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loadSummary(false))
      )
      .subscribe((rows) => {
        this.projectOptions = (rows as unknown[])
          .map((row) => resolveMyProjectOption(row))
          .filter((option): option is NonNullable<typeof option> => option !== null);
        this.cdr.markForCheck();
      });
  }

  private loadSummary(isManualRefresh: boolean): void {
    const { year, month, projectId } = this.filtersForm.getRawValue();
    const scopedProjectId = projectId || undefined;

    if (isManualRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }

    this.summaryError = '';

    forkJoin({
      monthly: this.hourService.summaryMonthlyMe(year).pipe(catchError(() => of(null))),
      totalHours: this.hourService.summaryTotalHoursMe({ year, month, projectId: scopedProjectId }).pipe(catchError(() => of(null))),
      breakdown: this.hourService.summaryBreakdownMe({ year, month, projectId: scopedProjectId }).pipe(catchError(() => of(null))),
      topProjects: this.hourService.summaryTopProjectsMe(year, 5).pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(({ monthly, totalHours, breakdown, topProjects }) => {
        this.monthlySummary = this.buildMonthlyCards(monthly);
        this.totalHoursCard = this.buildTotalHoursCard(totalHours);
        this.breakdownCards = this.buildBreakdownCards(breakdown);
        this.topProjects = this.buildTopProjects(topProjects);

        if (!this.monthlySummary.length && !this.breakdownCards.length && !this.topProjects.length) {
          this.summaryError = 'No summary data is available for the selected period yet.';
        }

        this.cdr.markForCheck();
      });
  }

  private buildMonthlyCards(source: unknown): SummaryMetricCard[] {
    const record = this.asRecord(source);
    if (!record) {
      return [];
    }

    const entries = [
      { title: 'Target hours', value: this.pickNumber(record, ['targetHours', 'TargetHours']) },
      { title: 'Logged hours', value: this.pickNumber(record, ['loggedHours', 'LoggedHours', 'totalHours', 'TotalHours']) },
      { title: 'Variance', value: this.pickNumber(record, ['variance', 'Variance']) },
      { title: 'Intern management', value: this.pickNumber(record, ['totalInternManagementHours', 'TotalInternManagementHours']) },
    ];

    return entries
      .filter((entry) => entry.value !== null)
      .map((entry) => ({
        title: entry.title,
        value: entry.value ?? 0,
        suffix: 'h',
      }));
  }

  private buildTotalHoursCard(source: unknown): SummaryMetricCard | null {
    const total = this.pickNumberFromUnknown(source, ['totalHours', 'TotalHours', 'hours', 'Hours', 'value', 'Value']);
    if (total === null) {
      return null;
    }

    return {
      title: 'Total hours this month',
      value: total,
      suffix: 'h',
      accent: 'primary',
    };
  }

  private buildBreakdownCards(source: unknown): BreakdownCard[] {
    const record = this.asRecord(source);
    if (!record) {
      return [];
    }

    const total: number =
      this.pickNumber(record, ['totalHours', 'TotalHours']) ??
      Object.values(record).reduce<number>((sum, value) => (typeof value === 'number' ? sum + value : sum), 0);

    return Object.entries(record)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => ({
        label: this.labelizeKey(key),
        hours: value as number,
        percent: total > 0 ? Math.round(((value as number) / total) * 100) : 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }

  private buildTopProjects(source: unknown): TopProjectCard[] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((item) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        const name = this.pickString(record, ['projectName', 'ProjectName', 'name', 'Name', 'label', 'Label']);
        const hours = this.pickNumber(record, ['totalHours', 'TotalHours', 'hours', 'Hours']);
        const monthHours = this.pickNumber(record, ['monthHours', 'MonthHours', 'currentMonthHours', 'CurrentMonthHours']);

        if (!name || (hours === null && monthHours === null)) {
          return null;
        }

        return {
          name,
          totalHours: hours ?? monthHours ?? 0,
          currentMonthHours: monthHours,
        };
      })
      .filter((item): item is TopProjectCard => item !== null)
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
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

  private pickString(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private pickNumberFromUnknown(source: unknown, keys: string[]): number | null {
    const record = this.asRecord(source);
    return record ? this.pickNumber(record, keys) : null;
  }

  private labelizeKey(key: string): string {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }
}

interface SummaryMetricCard {
  title: string;
  value: number;
  suffix?: string;
  accent?: 'primary' | 'neutral';
}

interface BreakdownCard {
  label: string;
  hours: number;
  percent: number;
}

interface TopProjectCard {
  name: string;
  totalHours: number;
  currentMonthHours: number | null;
}
