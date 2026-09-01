import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';

import { HourSummaryApiService } from '../../../../core/services/hour-summary-api.service';

interface HoursReportRow {
  label: string;
  hours: number;
  detail?: string;
}

@Component({
  selector: 'app-hours-summary-report-page',
  standalone: false,
  templateUrl: './hours-summary-report-page.html',
  styleUrl: './hours-summary-report-page.scss',
})
export class HoursSummaryReportPage implements OnInit {
  private readonly hourSummaryApi = inject(HourSummaryApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly year = new Date().getFullYear();
  isLoading = false;
  errorMessage = '';
  totalHours = 0;
  monthlyRows: HoursReportRow[] = [];
  projectRows: HoursReportRow[] = [];
  topProjectRows: HoursReportRow[] = [];

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      monthly: this.hourSummaryApi.meMonthly(this.year).pipe(catchError(() => of(null))),
      projects: this.hourSummaryApi.meProject(this.year).pipe(catchError(() => of(null))),
      topProjects: this.hourSummaryApi.meTopProjects(this.year, 5).pipe(catchError(() => of(null))),
    })
      .pipe(
        timeout(10000),
        catchError((err) => {
          console.error('Error loading hours report', err);
          return of({ monthly: null, projects: null, topProjects: null });
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: ({ monthly, projects, topProjects }) => {
          try {
            this.monthlyRows = this.toRows(monthly, ['monthName', 'MonthName', 'month', 'Month', 'name', 'Name', 'title', 'Title']);
            this.projectRows = this.toRows(projects, ['projectName', 'ProjectName', 'name', 'Name', 'title', 'Title']);
            this.topProjectRows = this.toRows(topProjects, ['projectName', 'ProjectName', 'name', 'Name', 'title', 'Title']);
            const mainRows = this.projectRows.length > 0 ? this.projectRows : this.monthlyRows;
            this.totalHours = mainRows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
          } catch (e) {
            console.error('Error parsing hours report data:', e);
            this.errorMessage = 'Failed to process report data.';
          }
        },
        error: (error) => {
          this.errorMessage = error?.message || 'Unable to load hours report.';
        },
      });
  }

  get hasData(): boolean {
    return this.monthlyRows.length > 0 || this.projectRows.length > 0 || this.topProjectRows.length > 0;
  }

  trackByLabel(_: number, row: HoursReportRow): string {
    return row.label;
  }

  private toRows(source: unknown, labelKeys: string[]): HoursReportRow[] {
    return this.asArray(source)
      .map((item) => {
        const row = this.asRecord(item);
        return {
          label: this.readString(row, labelKeys) || 'Unassigned',
          hours: this.readNumber(row, ['totalHours', 'TotalHours', 'hours', 'Hours', 'value', 'Value', 'loggedHours', 'LoggedHours']),
          detail: this.readString(row, ['year', 'Year', 'department', 'Department', 'status', 'Status']),
        };
      })
      .filter((row) => row.hours > 0 || row.label !== 'Unassigned');
  }

  private asArray(value: unknown): unknown[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    const row = this.asRecord(value);
    const nested = row['items'] ?? row['Items'] ?? row['data'] ?? row['Data'] ?? row['result'] ?? row['Result'] ?? row['monthly'] ?? row['projects'] ?? row['topProjects'];
    if (Array.isArray(nested)) {
      return nested;
    }

    const entries = Object.entries(row);
    if (entries.length > 0) {
      return entries.map(([key, val]) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return { name: key, ...(val as Record<string, unknown>) };
        }
        return { name: key, totalHours: val, value: val };
      });
    }

    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private readString(row: Record<string, unknown>, keys: string[]): string {
    const value = this.pick(row, keys);
    return value === undefined || value === null ? '' : String(value);
  }

  private readNumber(row: Record<string, unknown>, keys: string[]): number {
    const parsed = Number(this.pick(row, keys) ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private pick(row: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return row[key];
      }
    }
    return undefined;
  }
}

