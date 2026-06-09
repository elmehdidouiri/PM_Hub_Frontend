import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { AnalyticsDashboardDto } from '../models/analytics-dashboard.models';
import { AnalyticsDashboardService, buildAnalyticsQueryParams } from './analytics-dashboard.service';

describe('AnalyticsDashboardService query params', () => {
  let service: AnalyticsDashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AnalyticsDashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('builds the default FY YTD query without PascalCase duplicates', () => {
    const params = buildAnalyticsQueryParams({
      fiscalYear: 2026,
      periodMode: 'ytd',
      quickSelect: 'YTD',
      year: 2027,
    });

    expect(params.toString()).toBe('fiscalYear=2026&periodMode=ytd&quickSelect=YTD');
    expect(params.has('FiscalYear')).toBeFalsy();
    expect(params.has('Year')).toBeFalsy();
    expect(params.has('PeriodMode')).toBeFalsy();
    expect(params.has('QuickSelect')).toBeFalsy();
  });

  it('uses calendar year mode without fiscalYear ambiguity', () => {
    const params = buildAnalyticsQueryParams({
      year: 2026,
      fiscalYear: 2026,
      periodMode: 'year',
      quickSelect: 'YTD',
    });

    expect(params.toString()).toBe('fiscalYear=2026&periodMode=ytd&quickSelect=YTD');

    const calendarParams = buildAnalyticsQueryParams({
      year: 2026,
      fiscalYear: 2026,
      periodMode: 'year',
    });

    expect(calendarParams.toString()).toBe('year=2026&periodMode=year');
  });

  it('uses month mode with year and month only for the date filter', () => {
    const params = buildAnalyticsQueryParams({
      year: 2026,
      fiscalYear: 2026,
      month: 6,
      periodMode: 'month',
      quickSelect: 'month',
    });

    expect(params.toString()).toBe('year=2026&month=6&periodMode=month');
  });

  it('keeps active scope filters while cleaning empty values', () => {
    const params = buildAnalyticsQueryParams({
      fiscalYear: 2026,
      periodMode: 'ytd',
      quickSelect: 'YTD',
      departmentId: 'dep-1',
      userId: '',
      projectId: null,
      businessUnitId: undefined,
    });

    expect(params.toString()).toBe('fiscalYear=2026&periodMode=ytd&quickSelect=YTD&departmentId=dep-1');
  });

  it('sends a clean dashboard request URL', () => {
    service.getDashboard({
      fiscalYear: 2026,
      periodMode: 'ytd',
      quickSelect: 'YTD',
      year: 2027,
      departmentId: 'dep-1',
    }).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiUrl}/analytics/dashboard`);
    expect(req.request.params.toString()).toBe(
      'fiscalYear=2026&periodMode=ytd&quickSelect=YTD&departmentId=dep-1'
    );

    req.flush(makeDashboard());
  });
});

function makeDashboard(): AnalyticsDashboardDto {
  return {
    period: {
      year: 2026,
      month: 6,
      monthName: 'June',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      fiscalYear: 2026,
      fiscalYearStartMonth: 10,
      fiscalYearStartDate: '2025-10-01',
      fiscalYearEndDate: '2026-09-30',
    },
    summary: {
      averageEffectiveness: 0,
      averageOtd: 0,
      averageCsat: 0,
      totalProjects: 0,
      projectsWithData: 0,
      totalHours: 0,
      ytdHours: 0,
      averageMonthlyHours: 0,
      averageUtilization: 0,
      activeTeamMembers: 0,
    },
    kpis: {
      monthlyTrend: [],
    },
    hours: {
      monthlyByCategory: [],
      utilizationTrend: [],
      byBusinessUnit: [],
    },
  };
}
