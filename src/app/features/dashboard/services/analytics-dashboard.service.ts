import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models';
import {
  AnalyticsDashboardDto,
  AnalyticsDashboardParams,
  AnalyticsFiltersDto,
} from '../models/analytics-dashboard.models';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsDashboardService {
  private readonly apiUrl = `${environment.apiUrl}/analytics`;

  constructor(private readonly http: HttpClient) {}

  getDashboard(params: AnalyticsDashboardParams): Observable<AnalyticsDashboardDto> {
    return this.http
      .get<ApiResponse<AnalyticsDashboardDto> | AnalyticsDashboardDto>(`${this.apiUrl}/dashboard`, {
        params: this.buildParams(params),
      })
      .pipe(map((response) => this.normalizeDashboard(this.unwrap(response))));
  }

  getFilters(): Observable<AnalyticsFiltersDto> {
    return this.http
      .get<ApiResponse<AnalyticsFiltersDto> | AnalyticsFiltersDto>(`${this.apiUrl}/filters`)
      .pipe(map((response) => this.normalizeFilters(this.unwrap(response))));
  }

  getKpis(params: AnalyticsDashboardParams): Observable<AnalyticsDashboardDto['kpis']> {
    return this.http
      .get<ApiResponse<AnalyticsDashboardDto['kpis']> | AnalyticsDashboardDto['kpis']>(`${this.apiUrl}/kpis`, {
        params: this.buildParams(params),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getHours(params: AnalyticsDashboardParams): Observable<AnalyticsDashboardDto['hours']> {
    return this.http
      .get<ApiResponse<AnalyticsDashboardDto['hours']> | AnalyticsDashboardDto['hours']>(`${this.apiUrl}/hours`, {
        params: this.buildParams(params),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  private buildParams(params: AnalyticsDashboardParams): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    const aliases: Record<string, string> = {
      month: 'Month',
      year: 'Year',
      fiscalYear: 'FiscalYear',
      periodMode: 'PeriodMode',
      quickSelect: 'QuickSelect',
      userId: 'UserId',
      projectId: 'ProjectId',
      departmentId: 'DepartmentId',
      businessUnitId: 'BusinessUnitId',
      plantId: 'PlantId',
      projectStatus: 'ProjectStatus',
      projectPhase: 'ProjectPhase',
    };

    Object.entries(aliases).forEach(([key, alias]) => {
      const value = params[key as keyof AnalyticsDashboardParams];
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(alias, String(value));
      }
    });

    return httpParams;
  }

  private unwrap<T>(response: ApiResponse<T> | T): T {
    if (this.isApiResponse(response)) {
      const record = response as ApiResponse<T> & Record<string, unknown>;
      const data = response.data ?? record['Data'] ?? record['result'] ?? record['Result'] ?? record['payload'];

      if (response.success && data !== undefined && data !== null) {
        return data as T;
      }

      throw new Error(response.message || 'Unable to load analytics data.');
    }

    if (this.isLooseApiResponse(response)) {
      const success = response['success'] ?? response['Success'] ?? response['isSuccess'] ?? response['IsSuccess'];
      const data = response['data'] ?? response['Data'] ?? response['result'] ?? response['Result'] ?? response['payload'];

      if (success === false) {
        throw new Error(String(response['message'] ?? response['Message'] ?? 'Unable to load analytics data.'));
      }

      if (data !== undefined && data !== null) {
        return data as T;
      }
    }

    return response;
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
  }

  private isLooseApiResponse(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      ['Success', 'isSuccess', 'IsSuccess', 'Data', 'Result', 'payload'].some((key) => key in value)
    );
  }

  private normalizeDashboard(raw: unknown): AnalyticsDashboardDto {
    const row = this.asRecord(raw);
    const period = this.asRecord(this.pick(row, ['period', 'Period']));
    const summary = this.asRecord(this.pick(row, ['summary', 'Summary']));
    const kpis = this.asRecord(this.pick(row, ['kpis', 'Kpis', 'KPIs']));
    const hours = this.asRecord(this.pick(row, ['hours', 'Hours']));

    return {
      period: {
        year: this.num(period, ['year', 'Year']),
        month: this.num(period, ['month', 'Month']),
        monthName: this.str(period, ['monthName', 'MonthName']),
        startDate: this.str(period, ['startDate', 'StartDate']),
        endDate: this.str(period, ['endDate', 'EndDate']),
        fiscalYear: this.num(period, ['fiscalYear', 'FiscalYear']),
        fiscalYearStartMonth: this.num(period, ['fiscalYearStartMonth', 'FiscalYearStartMonth']),
        fiscalYearStartDate: this.str(period, ['fiscalYearStartDate', 'FiscalYearStartDate']),
        fiscalYearEndDate: this.str(period, ['fiscalYearEndDate', 'FiscalYearEndDate']),
      },
      summary: {
        averageEffectiveness: this.num(summary, ['averageEffectiveness', 'AverageEffectiveness']),
        averageOtd: this.num(summary, ['averageOtd', 'averageOTD', 'AverageOtd', 'AverageOTD']),
        averageCsat: this.num(summary, ['averageCsat', 'averageCSAT', 'AverageCsat', 'AverageCSAT']),
        totalProjects: this.num(summary, ['totalProjects', 'TotalProjects']),
        projectsWithData: this.num(summary, ['projectsWithData', 'ProjectsWithData']),
        totalHours: this.num(summary, ['totalHours', 'TotalHours']),
        ytdHours: this.num(summary, ['ytdHours', 'YtdHours', 'YTDHours']),
        averageMonthlyHours: this.num(summary, ['averageMonthlyHours', 'AverageMonthlyHours']),
        averageUtilization: this.num(summary, ['averageUtilization', 'AverageUtilization']),
        activeTeamMembers: this.num(summary, ['activeTeamMembers', 'ActiveTeamMembers']),
      },
      kpis: {
        monthlyTrend: this.array(this.pick(kpis, ['monthlyTrend', 'MonthlyTrend'])).map((item) => {
          const r = this.asRecord(item);
          return {
            year: this.num(r, ['year', 'Year']),
            month: this.num(r, ['month', 'Month']),
            monthName: this.str(r, ['monthName', 'MonthName']),
            effectiveness: this.num(r, ['effectiveness', 'Effectiveness']),
            otd: this.num(r, ['otd', 'OTD', 'Otd']),
            csat: this.num(r, ['csat', 'CSAT', 'Csat']),
            projectsWithData: this.num(r, ['projectsWithData', 'ProjectsWithData']),
          };
        }),
      },
      hours: {
        monthlyByCategory: this.array(this.pick(hours, ['monthlyByCategory', 'MonthlyByCategory'])).map((item) => {
          const r = this.asRecord(item);
          return {
            year: this.num(r, ['year', 'Year']),
            month: this.num(r, ['month', 'Month']),
            monthName: this.str(r, ['monthName', 'MonthName']),
            executionHours: this.num(r, ['executionHours', 'ExecutionHours']),
            technicalSupervisionHours: this.num(r, [
              'technicalSupervisionHours',
              'TechnicalSupervisionHours',
              'supervisionHours',
              'SupervisionHours',
            ]),
            processHours: this.num(r, ['processHours', 'ProcessHours']),
            projectManagementHours: this.num(r, [
              'projectManagementHours',
              'ProjectManagementHours',
              'managementHours',
              'ManagementHours',
            ]),
            researchAndDevHours: this.num(r, [
              'researchAndDevHours',
              'ResearchAndDevHours',
              'rAndDHours',
              'RAndDHours',
            ]),
            workshopHours: this.num(r, ['workshopHours', 'WorkshopHours']),
            otherHours: this.num(r, ['otherHours', 'OtherHours']),
            internManagementHours: this.num(r, ['internManagementHours', 'InternManagementHours']),
            totalHours: this.num(r, ['totalHours', 'TotalHours']),
          };
        }),
        utilizationTrend: this.array(this.pick(hours, ['utilizationTrend', 'UtilizationTrend'])).map((item) => {
          const r = this.asRecord(item);
          return {
            year: this.num(r, ['year', 'Year']),
            month: this.num(r, ['month', 'Month']),
            monthName: this.str(r, ['monthName', 'MonthName']),
            loggedHours: this.num(r, ['loggedHours', 'LoggedHours']),
            targetHours: this.num(r, ['targetHours', 'TargetHours']),
            utilizationPercentage: this.num(r, ['utilizationPercentage', 'UtilizationPercentage']),
          };
        }),
        byBusinessUnit: this.array(this.pick(hours, ['byBusinessUnit', 'ByBusinessUnit', 'buHours', 'BuHours'])).map(item => {
          const r = this.asRecord(item);
          return {
            label: this.str(r, ['businessUnitName', 'BusinessUnitName', 'label', 'Label', 'name', 'Name', 'buName', 'BuName']),
            hours: this.num(r, ['totalHours', 'TotalHours', 'hours', 'Hours', 'value', 'Value'])
          };
        })
      },
    };
  }

  private normalizeFilters(raw: unknown): AnalyticsFiltersDto {
    const row = this.asRecord(raw);
    return {
      fiscalYears: this.array(this.pick(row, ['fiscalYears', 'FiscalYears'])).map((item) => Number(item)).filter(Number.isFinite),
      months: this.array(this.pick(row, ['months', 'Months'])).map((item) => {
        const r = this.asRecord(item);
        return {
          value: this.num(r, ['value', 'Value', 'month', 'Month']),
          label: this.str(r, ['label', 'Label', 'name', 'Name', 'monthName', 'MonthName']),
        };
      }),
      users: this.optionArray(this.pick(row, ['users', 'Users'])),
      projects: this.optionArray(this.pick(row, ['projects', 'Projects'])),
      departments: this.optionArray(this.pick(row, ['departments', 'Departments'])),
      businessUnits: this.optionArray(this.pick(row, ['businessUnits', 'BusinessUnits'])),
      plants: this.optionArray(this.pick(row, ['plants', 'Plants'])),
    };
  }

  private optionArray(source: unknown): Array<{ id: string; label: string }> {
    return this.array(source).map((item) => {
      const r = this.asRecord(item);
      return {
        id: this.str(r, ['id', 'Id', 'value', 'Value']),
        label: this.str(r, ['label', 'Label', 'name', 'Name', 'fullName', 'FullName']),
      };
    }).filter((item) => item.id || item.label);
  }

  private pick(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private str(record: Record<string, unknown>, keys: string[]): string {
    const value = this.pick(record, keys);
    return value === undefined || value === null ? '' : String(value);
  }

  private num(record: Record<string, unknown>, keys: string[]): number {
    const value = this.pick(record, keys);
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
