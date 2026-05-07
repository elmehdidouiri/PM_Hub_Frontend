import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateHourEntryDto,
  HourEntryDto,
  HourEntryMyProjectDto,
  HourEntryPremiumApproveDto,
  HourEntryUpdateDto,
  MonthlyHoursDashboardDto,
  ProjectInternAllocationDto,
  YtdDashboardDto,
} from '../models/hour-entry.model';
import { ApiResponse } from '../models';
import { HourEntriesMapperService } from './hour-entries-mapper.service';

/**
 * HourEntriesApiService – SOLID-compliant thin HTTP client.
 *
 * Single Responsibility: only issues HTTP requests and delegates all
 * response normalisation to HourEntriesMapperService (SRP).
 *
 * Dependency Inversion: depends on the HourEntriesMapperService abstraction,
 * not on inline normalization logic. The mapper can be swapped/extended
 * independently (OCP).
 */
@Injectable({ providedIn: 'root' })
export class HourEntriesApiService {
  private readonly apiUrl = `${environment.apiUrl}/hour-entries`;

  constructor(
    private readonly http: HttpClient,
    private readonly mapper: HourEntriesMapperService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  create(payload: CreateHourEntryDto): Observable<HourEntryDto | null> {
    return this.http
      .post<ApiResponse<HourEntryDto> | HourEntryDto>(this.apiUrl, payload)
      .pipe(map((r) => this.mapper.toHourEntry(this.unwrapItem(r))));
  }

  update(id: string, payload: HourEntryUpdateDto): Observable<HourEntryDto | null> {
    return this.http
      .put<ApiResponse<HourEntryDto> | HourEntryDto>(`${this.apiUrl}/${id}`, payload)
      .pipe(map((r) => this.mapper.toHourEntry(this.unwrapItem(r))));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`)
      .pipe(map((r) => this.unwrapVoid(r)));
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  getMy(): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my`)
      .pipe(map((r) => this.mapper.toHourEntryArray(this.unwrapList(r))));
  }

  getMyByDate(date: string): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my/date`, { params: { date } })
      .pipe(map((r) => this.mapper.toHourEntryArray(this.unwrapList(r))));
  }

  getMyByMonth(year: number, month: number): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my/month`, {
        params: { year, month } as any,
      })
      .pipe(map((r) => this.mapper.toHourEntryArray(this.unwrapList(r))));
  }

  getByProject(projectId: string): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/project/${projectId}`)
      .pipe(map((r) => this.mapper.toHourEntryArray(this.unwrapList(r))));
  }

  getDashboardMonthly(year: number, month: number): Observable<MonthlyHoursDashboardDto | null> {
    return this.http
      .get<ApiResponse<MonthlyHoursDashboardDto> | MonthlyHoursDashboardDto>(
        `${this.apiUrl}/dashboard/monthly`,
        { params: { year, month } as any },
      )
      .pipe(map((r) => this.mapper.toMonthlyDashboard(this.unwrapItem(r))));
  }

  getDashboardYtd(companyYear?: string | number): Observable<YtdDashboardDto | null> {
    const options =
      companyYear === undefined || companyYear === null
        ? {}
        : { params: { companyYear } as any };
    return this.http
      .get<ApiResponse<YtdDashboardDto> | YtdDashboardDto>(`${this.apiUrl}/dashboard/ytd`, options)
      .pipe(map((r) => this.mapper.toYtdDashboard(this.unwrapItem(r))));
  }

  getMyProjects(): Observable<HourEntryMyProjectDto[]> {
    return this.http
      .get<ApiResponse<HourEntryMyProjectDto[]> | HourEntryMyProjectDto[]>(`${this.apiUrl}/my/projects`)
      .pipe(map((r) => this.unwrapList(r) as HourEntryMyProjectDto[]));
  }

  getMySupervisedInterns(): Observable<ProjectInternAllocationDto[]> {
    return this.http
      .get<ApiResponse<ProjectInternAllocationDto[]> | ProjectInternAllocationDto[]>(
        `${this.apiUrl}/my/supervised-interns`,
      )
      .pipe(map((r) => this.unwrapList(r) as ProjectInternAllocationDto[]));
  }

  getPremiumPending(): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/premium/pending`)
      .pipe(map((r) => this.mapper.toHourEntryArray(this.unwrapList(r))));
  }

  approvePremium(payload: HourEntryPremiumApproveDto): Observable<void> {
    return this.http
      .put<ApiResponse<void> | void>(`${this.apiUrl}/premium/approve`, payload)
      .pipe(map((r) => this.unwrapVoid(r)));
  }

  // ─── Private unwrap helpers ───────────────────────────────────────────────

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) return response;
    if (this.isApiResponse(response) && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }
    return response ?? null;
  }

  private unwrapVoid(response: ApiResponse<void> | void): void {
    if (response === undefined) return;
    if (this.isApiResponse(response) && response.success) return;
    if (this.isApiResponse(response)) throw new Error(response.message || 'Request failed');
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }
}
