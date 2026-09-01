import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, CapacityPriceDashboardDto, CapacityPriceQueryDto, InternCapacityPriceAnalyticsDto, MemberTahDashboardDto, MemberTahQuery } from '../../../core/models';
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
        params: buildAnalyticsQueryParams(params),
      })
      .pipe(map((response) => this.normalizeDashboard(this.unwrap(response))));
  }

  getCapacityPriceDashboard(params: CapacityPriceQueryDto): Observable<CapacityPriceDashboardDto> {
    let httpParams = new HttpParams();
    if (params.year) httpParams = httpParams.set('year', params.year.toString());
    if (params.month) httpParams = httpParams.set('month', params.month.toString());
    if (params.targetHoursPerMember) httpParams = httpParams.set('targetHoursPerMember', params.targetHoursPerMember.toString());
    if (params.hourlyRate) httpParams = httpParams.set('hourlyRate', params.hourlyRate.toString());

    return this.http
      .get<ApiResponse<CapacityPriceDashboardDto> | CapacityPriceDashboardDto>(`${this.apiUrl}/capacity-price`, {
        params: httpParams,
      })
      .pipe(map((response) => this.normalizeCapacityPriceDashboard(this.unwrap(response))));
  }

  getInternCapacityPriceDashboard(params: CapacityPriceQueryDto): Observable<InternCapacityPriceAnalyticsDto> {
    let httpParams = new HttpParams();
    if (params.year) httpParams = httpParams.set('year', params.year.toString());
    if (params.month) httpParams = httpParams.set('month', params.month.toString());
    if (params.targetHoursPerIntern) httpParams = httpParams.set('targetHoursPerIntern', params.targetHoursPerIntern.toString());
    if (params.hourlyRate) httpParams = httpParams.set('hourlyRate', params.hourlyRate.toString());

    return this.http
      .get<ApiResponse<InternCapacityPriceAnalyticsDto> | InternCapacityPriceAnalyticsDto>(`${this.apiUrl}/intern-capacity-price`, {
        params: httpParams,
      })
      .pipe(map((response) => this.normalizeInternCapacityPriceDashboard(this.unwrap(response))));
  }

  getMemberTahDashboard(params: MemberTahQuery): Observable<MemberTahDashboardDto> {
    return this.http
      .get<ApiResponse<MemberTahDashboardDto> | MemberTahDashboardDto>(`${this.apiUrl}/member-tah`, {
        params: this.buildMemberTahParams(params),
      })
      .pipe(map((response) => this.normalizeMemberTahDashboard(this.unwrap(response))));
  }

  exportMemberTahDashboard(params: MemberTahQuery): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiUrl}/member-tah/export`, {
      observe: 'response',
      params: this.buildMemberTahParams(params),
      responseType: 'blob',
    });
  }

  getFilters(): Observable<AnalyticsFiltersDto> {
    return this.http
      .get<ApiResponse<AnalyticsFiltersDto> | AnalyticsFiltersDto>(`${this.apiUrl}/filters`)
      .pipe(map((response) => this.normalizeFilters(this.unwrap(response))));
  }

  getKpis(params: AnalyticsDashboardParams): Observable<AnalyticsDashboardDto['kpis']> {
    return this.http
      .get<ApiResponse<AnalyticsDashboardDto['kpis']> | AnalyticsDashboardDto['kpis']>(`${this.apiUrl}/kpis`, {
        params: buildAnalyticsQueryParams(params),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getHours(params: AnalyticsDashboardParams): Observable<AnalyticsDashboardDto['hours']> {
    return this.http
      .get<ApiResponse<AnalyticsDashboardDto['hours']> | AnalyticsDashboardDto['hours']>(`${this.apiUrl}/hours`, {
        params: buildAnalyticsQueryParams(params),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  private buildMemberTahParams(params: MemberTahQuery): HttpParams {
    let httpParams = new HttpParams();
    const entries: Array<[keyof MemberTahQuery, string | number | undefined]> = [
      ['year', params.year],
      ['month', params.month],
      ['fiscalYear', params.fiscalYear],
      ['tahMonthlyHoursTarget', params.tahMonthlyHoursTarget],
      ['periodMode', params.periodMode],
      ['quickSelect', params.quickSelect],
      ['userId', params.userId],
      ['projectId', params.projectId],
      ['departmentId', params.departmentId],
      ['businessUnitId', params.businessUnitId],
      ['plantId', params.plantId],
      ['projectStatus', params.projectStatus],
      ['projectPhase', params.projectPhase],
    ];

    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

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
        averageEffectiveness: this.num(summary, [
          'averageEffectiveness',
          'AverageEffectiveness',
          'avgEffectiveness',
          'AvgEffectiveness',
          'effectiveness',
          'Effectiveness',
          'effectivenessPercentage',
          'EffectivenessPercentage',
          'averageEffectivenessPercentage',
          'AverageEffectivenessPercentage',
          'progress',
          'Progress',
        ]),
        averageOtd: this.num(summary, ['averageOtd', 'averageOTD', 'AverageOtd', 'AverageOTD']),
        averageCsat: this.num(summary, [
          'averageCsat',
          'averageCSAT',
          'AverageCsat',
          'AverageCSAT',
          'avgCsat',
          'AvgCsat',
          'csat',
          'CSAT',
          'customerSatisfaction',
          'CustomerSatisfaction',
          'customerSatisfactionPercentage',
          'CustomerSatisfactionPercentage',
          'averageCustomerSatisfaction',
          'AverageCustomerSatisfaction',
          'averageCustomerSatisfactionPercentage',
          'AverageCustomerSatisfactionPercentage',
        ]),
        totalProjects: this.num(summary, ['totalProjects', 'TotalProjects']),
        projectsWithData: this.num(summary, ['projectsWithData', 'ProjectsWithData']),
        totalHours: this.num(summary, ['totalHours', 'TotalHours']),
        ytdHours: this.num(summary, ['ytdHours', 'YtdHours', 'YTDHours']),
        averageMonthlyHours: this.num(summary, ['averageMonthlyHours', 'AverageMonthlyHours']),
        averageUtilization: this.num(summary, ['averageUtilization', 'AverageUtilization']),
        activeTeamMembers: this.num(summary, ['activeTeamMembers', 'ActiveTeamMembers']),
      },
      kpis: {
        monthlyTrend: this.array(this.pick(kpis, [
          'monthlyTrend',
          'MonthlyTrend',
          'monthlyKpis',
          'MonthlyKpis',
          'monthlyKPIs',
          'MonthlyKPIs',
          'kpiTrend',
          'KpiTrend',
          'KPITrend',
          'trend',
          'Trend',
        ])).map((item) => {
          const r = this.asRecord(item);
          return {
            year: this.num(r, ['year', 'Year']),
            month: this.num(r, ['month', 'Month']),
            monthName: this.str(r, ['monthName', 'MonthName']),
            effectiveness: this.num(r, [
              'effectiveness',
              'Effectiveness',
              'avgEffectiveness',
              'AvgEffectiveness',
              'averageEffectiveness',
              'AverageEffectiveness',
              'effectivenessPercentage',
              'EffectivenessPercentage',
              'averageEffectivenessPercentage',
              'AverageEffectivenessPercentage',
              'progress',
              'Progress',
            ]),
            otd: this.num(r, [
              'otd',
              'OTD',
              'Otd',
              'avgOtd',
              'AvgOtd',
              'averageOtd',
              'averageOTD',
              'AverageOtd',
              'AverageOTD',
              'onTimeDelivery',
              'OnTimeDelivery',
              'onTimeDeliveryPercentage',
              'OnTimeDeliveryPercentage',
            ]),
            csat: this.num(r, [
              'csat',
              'CSAT',
              'Csat',
              'avgCsat',
              'AvgCsat',
              'averageCsat',
              'AverageCsat',
              'customerSatisfaction',
              'CustomerSatisfaction',
              'customerSatisfactionPercentage',
              'CustomerSatisfactionPercentage',
              'averageCustomerSatisfaction',
              'AverageCustomerSatisfaction',
              'averageCustomerSatisfactionPercentage',
              'AverageCustomerSatisfactionPercentage',
            ]),
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

  private normalizeCapacityPriceDashboard(raw: unknown): CapacityPriceDashboardDto {
    const row = this.asRecord(raw);
    return {
      memberCapacities: this.array(this.pick(row, ['memberCapacities', 'MemberCapacities'])).map((item) =>
        this.normalizeMemberCapacity(item)
      ),
      capacityTarget: this.normalizeCapacityTarget(this.pick(row, ['capacityTarget', 'CapacityTarget'])),
      memberPrices: this.array(this.pick(row, ['memberPrices', 'MemberPrices'])).map((item) =>
        this.normalizeMemberPrice(item)
      ),
      priceTarget: this.normalizePriceTarget(this.pick(row, ['priceTarget', 'PriceTarget'])),
    };
  }

  private normalizeInternCapacityPriceDashboard(raw: unknown): InternCapacityPriceAnalyticsDto {
    const row = this.asRecord(raw);
    return {
      totalInterns: this.num(row, ['totalInterns', 'TotalInterns']),
      activeInternsWithEntries: this.num(row, ['activeInternsWithEntries', 'ActiveInternsWithEntries']),
      capacityTarget: this.normalizeCapacityTarget(this.pick(row, ['capacityTarget', 'CapacityTarget'])),
      priceTarget: this.normalizePriceTarget(this.pick(row, ['priceTarget', 'PriceTarget'])),
      internDetails: this.array(this.pick(row, ['internDetails', 'InternDetails'])).map((item) => {
        const r = this.asRecord(item);
        return {
          internId: this.str(r, ['internId', 'InternId']),
          internName: this.str(r, ['internName', 'InternName']),
          role: this.str(r, ['role', 'Role']),
          supervisorName: this.str(r, ['supervisorName', 'SupervisorName']),
          bookedHours: this.num(r, ['bookedHours', 'BookedHours']),
          progressionPercentage: this.num(r, ['progressionPercentage', 'ProgressionPercentage']),
          bookedPrice: this.num(r, ['bookedPrice', 'BookedPrice']),
          entriesCount: this.num(r, ['entriesCount', 'EntriesCount']),
        };
      }),
      projectDetails: this.array(this.pick(row, ['projectDetails', 'ProjectDetails'])).map((item) => {
        const r = this.asRecord(item);
        return {
          projectId: this.str(r, ['projectId', 'ProjectId']),
          projectName: this.str(r, ['projectName', 'ProjectName']),
          bookedHours: this.num(r, ['bookedHours', 'BookedHours']),
          bookedPrice: this.num(r, ['bookedPrice', 'BookedPrice']),
          internsCount: this.num(r, ['internsCount', 'InternsCount']),
          entriesCount: this.num(r, ['entriesCount', 'EntriesCount']),
        };
      }),
    };
  }

  private normalizeMemberTahDashboard(raw: unknown): MemberTahDashboardDto {
    const row = this.asRecord(raw);
    const period = this.asRecord(this.pick(row, ['period', 'Period']));
    const summary = this.asRecord(this.pick(row, ['summary', 'Summary']));
    
    return {
      period: {
        year: this.num(period, ['year']),
        month: this.num(period, ['month']),
        monthName: this.str(period, ['monthName']),
        startDate: this.str(period, ['startDate']),
        endDate: this.str(period, ['endDate']),
        fiscalYear: this.num(period, ['fiscalYear']),
        fiscalYearStartMonth: this.num(period, ['fiscalYearStartMonth']),
        fiscalYearStartDate: this.str(period, ['fiscalYearStartDate']),
        fiscalYearEndDate: this.str(period, ['fiscalYearEndDate'])
      },
      tahMonthlyHoursTarget: this.num(row, ['tahMonthlyHoursTarget']),
      summary: {
        employeeCount: this.num(summary, ['employeeCount']),
        subcontractorCount: this.num(summary, ['subcontractorCount']),
        averageEffectiveness: this.num(summary, ['averageEffectiveness']),
        cumulativeTahHours: this.num(summary, ['cumulativeTahHours']),
        employeeTahHours: this.num(summary, ['employeeTahHours']),
        subcontractorTahHours: this.num(summary, ['subcontractorTahHours']),
        employeeSharePercentage: this.num(summary, ['employeeSharePercentage']),
        subcontractorSharePercentage: this.num(summary, ['subcontractorSharePercentage']),
      },
      monthlyBreakdown: this.array(this.pick(row, ['monthlyBreakdown'])).map((item) => {
        const r = this.asRecord(item);
        return {
          year: this.num(r, ['year']),
          month: this.num(r, ['month']),
          monthName: this.str(r, ['monthName']),
          employeeCount: this.num(r, ['employeeCount']),
          subcontractorCount: this.num(r, ['subcontractorCount']),
          averageEffectiveness: this.num(r, ['averageEffectiveness']),
          tahHours: this.num(r, ['tahHours']),
          employeeTahHours: this.num(r, ['employeeTahHours']),
          subcontractorTahHours: this.num(r, ['subcontractorTahHours']),
          employeeSharePercentage: this.num(r, ['employeeSharePercentage']),
          subcontractorSharePercentage: this.num(r, ['subcontractorSharePercentage']),
        };
      }),
      members: this.array(this.pick(row, ['members'])).map((item) => {
        const r = this.asRecord(item);
        return {
          userId: this.str(r, ['userId']),
          userName: this.str(r, ['userName']),
          memberType: this.num(r, ['memberType']) as any,
          memberTypeLabel: this.str(r, ['memberTypeLabel']) as any,
          bookedHours: this.num(r, ['bookedHours']),
          effectiveness: this.num(r, ['effectiveness']),
          tahHours: this.num(r, ['tahHours']),
          monthly: this.array(this.pick(r, ['monthly'])).map((mItem) => {
            const mr = this.asRecord(mItem);
            return {
              year: this.num(mr, ['year']),
              month: this.num(mr, ['month']),
              monthName: this.str(mr, ['monthName']),
              bookedHours: this.num(mr, ['bookedHours']),
              effectiveness: this.num(mr, ['effectiveness']),
              tahHours: this.num(mr, ['tahHours']),
            };
          }),
        };
      }),
    };
  }

  private normalizeMemberCapacity(item: unknown) {
    const r = this.asRecord(item);
    return {
      userId: this.str(r, ['userId', 'UserId']),
      userName: this.str(r, ['userName', 'UserName']),
      bookedHours: this.num(r, ['bookedHours', 'BookedHours']),
      percentage: this.num(r, ['percentage', 'Percentage']),
    };
  }

  private normalizeMemberPrice(item: unknown) {
    const r = this.asRecord(item);
    return {
      userId: this.str(r, ['userId', 'UserId']),
      userName: this.str(r, ['userName', 'UserName']),
      bookedPrice: this.num(r, ['bookedPrice', 'BookedPrice']),
      percentage: this.num(r, ['percentage', 'Percentage']),
    };
  }

  private normalizeCapacityTarget(raw: unknown) {
    const r = this.asRecord(raw);
    return {
      actualBookedHours: this.num(r, ['actualBookedHours', 'ActualBookedHours']),
      targetHours: this.num(r, ['targetHours', 'TargetHours']),
      remainingHours: this.num(r, ['remainingHours', 'RemainingHours']),
    };
  }

  private normalizePriceTarget(raw: unknown) {
    const r = this.asRecord(raw);
    const bookedPrice = this.num(r, ['bookedPrice', 'BookedPrice']);
    const remainingPrice = this.num(r, ['remainingPrice', 'RemainingPrice']);
    const targetPrice = this.num(r, ['targetPrice', 'TargetPrice']);
    return {
      bookedPrice,
      remainingPrice,
      targetPrice: targetPrice || bookedPrice + remainingPrice,
    };
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

export function buildAnalyticsQueryParams(filters: AnalyticsDashboardParams): HttpParams {
  let httpParams = new HttpParams();
  const params = normalizeAnalyticsDashboardParams(filters);

  (Object.keys(params) as Array<keyof AnalyticsDashboardParams>).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  });

  return httpParams;
}

function normalizeAnalyticsDashboardParams(filters: AnalyticsDashboardParams): AnalyticsDashboardParams {
  const periodMode = normalizePeriodMode(filters.periodMode);
  const quickSelect = normalizeQuickSelect(filters.quickSelect);
  const isYtd = periodMode === 'ytd' || quickSelect === 'YTD';

  const scopeParams: AnalyticsDashboardParams = {
    userId: filters.userId,
    projectId: filters.projectId,
    departmentId: filters.departmentId,
    businessUnitId: filters.businessUnitId,
    plantId: filters.plantId,
    projectStatus: filters.projectStatus,
    projectPhase: filters.projectPhase,
  };

  if (isYtd) {
    return cleanParams({
      fiscalYear: filters.fiscalYear,
      periodMode: 'ytd',
      quickSelect: 'YTD',
      ...scopeParams,
    });
  }

  if (periodMode === 'month') {
    return cleanParams({
      year: filters.year,
      month: filters.month,
      periodMode: 'month',
      ...scopeParams,
    });
  }

  return cleanParams({
    year: filters.year,
    periodMode: periodMode ?? (filters.year ? 'year' : null),
    ...scopeParams,
  });
}

function normalizePeriodMode(value: string | null | undefined): string | null {
  return value ? String(value).trim().toLowerCase() : null;
}

function normalizeQuickSelect(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.toUpperCase() === 'YTD' ? 'YTD' : normalized.toLowerCase();
}

function cleanParams(params: AnalyticsDashboardParams): AnalyticsDashboardParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as AnalyticsDashboardParams;
}
