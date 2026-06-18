import { Injectable } from '@angular/core';
import {
  HourEntryDto,
  MonthlyHoursDashboardDto,
  YtdDashboardDto,
} from '../models/hour-entry.model';

/**
 * HourEntriesMapperService – Phase 2 SOLID refactor (SRP / OCP / DIP).
 *
 * Responsibility: Convert raw / unknown API responses into strongly-typed
 * application models.  All normalization (key-alias lookup, type coercion,
 * defaults) lives here so HourEntriesApiService stays a thin HTTP client.
 *
 * Open/Closed: add support for a new API field by extending the alias list –
 * no changes to the HTTP service are needed.
 */
@Injectable({ providedIn: 'root' })
export class HourEntriesMapperService {
  // ─── Public mapping entry-points ─────────────────────────────────────────

  toHourEntryArray(raw: unknown[]): HourEntryDto[] {
    return raw.map((item) => this.toHourEntry(item));
  }

  toHourEntry(raw: unknown): HourEntryDto {
    const r = this.toRecord(raw);
    if (!r) return { id: '' };
    return {
      id: this.readString(r, ['id', 'Id']),
      userId: this.readString(r, ['userId', 'UserId']) || undefined,
      userFullName: this.readString(r, ['userFullName', 'UserFullName']) || undefined,
      projectId: this.readString(r, ['projectId', 'ProjectId']) || undefined,
      projectName: this.readString(r, ['projectName', 'ProjectName']) || undefined,
      date: this.readString(r, ['date', 'Date']) || undefined,
      totalHours: this.readNumber(r, ['totalHours', 'TotalHours']),
      executionHours: this.readNumber(r, ['executionHours', 'ExecutionHours']),
      supervisionHours: this.readNumber(r, ['supervisionHours', 'SupervisionHours', 'technicalSupervisionHours', 'TechnicalSupervisionHours']),
      processHours: this.readNumber(r, ['processHours', 'ProcessHours', 'processRelatedHours', 'ProcessRelatedHours']),
      managementHours: this.readNumber(r, ['managementHours', 'ManagementHours', 'projectManagementHours', 'ProjectManagementHours']),
      rAndDHours: this.readNumber(r, ['rAndDHours', 'RAndDHours', 'researchAndDevHours', 'ResearchAndDevHours']),
      workshopHours: this.readNumber(r, ['workshopHours', 'WorkshopHours']),
      otherHours: this.readNumber(r, ['otherHours', 'OtherHours', 'otherActivitiesHours', 'OtherActivitiesHours']),
      internManagementHours: this.readNumber(r, ['internManagementHours', 'InternManagementHours']),
      hourlyRate: this.readNumber(r, ['hourlyRate', 'HourlyRate']),
      totalCost: this.readNumber(r, ['totalCost', 'TotalCost']),
      bookingType: this.readNumber(r, ['bookingType', 'BookingType']) as number | undefined,
      isPremium: Boolean(this.readValue(r, ['isPremium', 'IsPremium'])),
      premiumReason: this.readString(r, ['premiumReason', 'PremiumReason']) || null,
      premiumApprovalStatus: this.readString(r, ['premiumApprovalStatus', 'PremiumApprovalStatus']) || null,
      notes: this.readString(r, ['notes', 'Notes']) || null,
      createdAt: this.readString(r, ['createdAt', 'CreatedAt']) || undefined,
      updatedAt: this.readString(r, ['updatedAt', 'UpdatedAt']) || null,
    };
  }

  toYtdDashboard(raw: unknown): YtdDashboardDto | null {
    const r = this.toRecord(raw);
    if (!r) return null;

    const monthlyBreakdown = this.readArray(r, ['monthlyBreakdown', 'MonthlyBreakdown', 'months', 'Months'])
      .map((m) => this.toMonthlyDashboard(m))
      .filter((m): m is MonthlyHoursDashboardDto => m !== null);

    return {
      companyYear: this.readNumber(r, ['companyYear', 'CompanyYear', 'year', 'Year']),
      fiscalYearLabel: this.readString(r, ['fiscalYearLabel', 'FiscalYearLabel']),
      ytdHours: this.readNumber(r, ['ytdHours', 'YtdHours', 'YTDHours', 'totalHours', 'TotalHours']),
      expectedHours: this.readNumber(r, ['expectedHours', 'ExpectedHours']),
      variance: this.readNumber(r, ['variance', 'Variance']),
      projectedYearEnd: this.readNumber(r, ['projectedYearEnd', 'ProjectedYearEnd']),
      monthlyRecommendation: this.readNumber(r, ['monthlyRecommendation', 'MonthlyRecommendation']),
      ytdCost: this.readNumber(r, ['ytdCost', 'YtdCost', 'YTDCost', 'totalCost', 'TotalCost']),
      premiumHours: this.readNumber(r, ['premiumHours', 'PremiumHours']),
      premiumApprovedCost: this.readNumber(r, ['premiumApprovedCost', 'PremiumApprovedCost']),
      premiumPendingHours: this.readNumber(r, ['premiumPendingHours', 'PremiumPendingHours']),
      monthlyBreakdown,
      completionPercentage: this.readNumber(r, ['completionPercentage', 'CompletionPercentage', 'progress', 'Progress']),
      performanceStatus: this.readString(r, ['performanceStatus', 'PerformanceStatus', 'status', 'Status']),
    };
  }

  toMonthlyDashboard(raw: unknown): MonthlyHoursDashboardDto | null {
    const r = this.toRecord(raw);
    if (!r) return null;

    return {
      year: this.readNumber(r, ['year', 'Year']),
      month: this.readNumber(r, ['month', 'Month']),
      monthName: this.readString(r, ['monthName', 'MonthName']),
      loggedHours: this.readNumber(r, ['loggedHours', 'LoggedHours', 'totalHours', 'TotalHours']),
      targetHours: this.readNumber(r, ['targetHours', 'TargetHours']),
      variance: this.readNumber(r, ['variance', 'Variance']),
      totalCost: this.readNumber(r, ['totalCost', 'TotalCost']),
      workingDays: this.readNumber(r, ['workingDays', 'WorkingDays']),
      dailyTarget: this.readNumber(r, ['dailyTarget', 'DailyTarget']),
      daysLeft: this.readNumber(r, ['daysLeft', 'DaysLeft']),
      dailyNeeded: this.readNumber(r, ['dailyNeeded', 'DailyNeeded']),
      progress: this.readNumber(r, ['progress', 'Progress']),
      premiumHours: this.readNumber(r, ['premiumHours', 'PremiumHours']),
      premiumPendingHours: this.readNumber(r, ['premiumPendingHours', 'PremiumPendingHours']),
      totalExecutionHours: this.readNumber(r, ['totalExecutionHours', 'ExecutionHours']),
      totalSupervisionHours: this.readNumber(r, [
        'totalSupervisionHours', 'TotalSupervisionHours',
        'totalTechnicalSupervisionHours', 'TotalTechnicalSupervisionHours',
        'supervisionHours', 'SupervisionHours',
      ]),
      totalProcessHours: this.readNumber(r, [
        'totalProcessHours', 'TotalProcessHours',
        'totalProcessRelatedHours', 'TotalProcessRelatedHours',
        'processHours', 'ProcessHours',
      ]),
      totalManagementHours: this.readNumber(r, [
        'totalManagementHours', 'TotalManagementHours',
        'totalProjectManagementHours', 'TotalProjectManagementHours',
        'managementHours', 'ManagementHours',
      ]),
      totalRAndDHours: this.readNumber(r, [
        'totalRAndDHours', 'TotalRAndDHours',
        'totalResearchAndDevHours', 'TotalResearchAndDevHours',
        'rAndDHours', 'RAndDHours',
      ]),
      totalWorkshopHours: this.readNumber(r, ['totalWorkshopHours', 'TotalWorkshopHours', 'workshopHours', 'WorkshopHours']),
      totalOtherHours: this.readNumber(r, [
        'totalOtherHours', 'TotalOtherHours',
        'totalOtherActivitiesHours', 'TotalOtherActivitiesHours',
        'otherHours', 'OtherHours',
      ]),
      totalInternManagementHours: this.readNumber(r, [
        'totalInternManagementHours', 'TotalInternManagementHours',
        'internManagementHours', 'InternManagementHours',
      ]),
      entries: this.readArray(r, ['entries', 'Entries']) as HourEntryDto[],
      isOnTrack: Boolean(this.readValue(r, ['isOnTrack', 'IsOnTrack'])),
      status: this.readString(r, ['status', 'Status']),
    };
  }

  // ─── Primitive read helpers (package-private / reusable) ─────────────────

  toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  readValue(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (key in record) return record[key];
    }
    return null;
  }

  readNumber(record: Record<string, unknown>, keys: string[]): number {
    const value = this.readValue(record, keys);
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  readString(record: Record<string, unknown>, keys: string[]): string {
    const value = this.readValue(record, keys);
    return typeof value === 'string' ? value : '';
  }

  readArray(record: Record<string, unknown>, keys: string[]): unknown[] {
    const value = this.readValue(record, keys);
    return Array.isArray(value) ? value : [];
  }
}
