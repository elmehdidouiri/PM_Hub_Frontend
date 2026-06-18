import { Component, OnInit, inject } from '@angular/core';
import { forkJoin } from 'rxjs';

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
      monthly: this.hourSummaryApi.meMonthly(this.year),
      projects: this.hourSummaryApi.meProject(this.year),
      topProjects: this.hourSummaryApi.meTopProjects(this.year, 5),
    }).subscribe({
      next: ({ monthly, projects, topProjects }) => {
        this.monthlyRows = this.toRows(monthly, ['monthName', 'MonthName', 'month', 'Month']);
        this.projectRows = this.toRows(projects, ['projectName', 'ProjectName', 'name', 'Name']);
        this.topProjectRows = this.toRows(topProjects, ['projectName', 'ProjectName', 'name', 'Name']);
        this.totalHours = this.projectRows.reduce((sum, row) => sum + row.hours, 0);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
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
          hours: this.readNumber(row, ['totalHours', 'TotalHours', 'hours', 'Hours', 'value', 'Value']),
          detail: this.readString(row, ['year', 'Year', 'department', 'Department', 'status', 'Status']),
        };
      })
      .filter((row) => row.hours > 0 || row.label !== 'Unassigned');
  }

  private asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    const row = this.asRecord(value);
    const nested = row['items'] ?? row['Items'] ?? row['data'] ?? row['Data'] ?? row['result'] ?? row['Result'];
    return Array.isArray(nested) ? nested : [];
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

