import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateHourEntryDto,
  HourEntryDashboardMonthlyDto,
  HourEntryDto,
  HourEntryMyProjectDto,
  HourEntryPremiumApproveDto,
  HourEntryUpdateDto,
  ProjectInternAllocationDto,
  YtdDashboardDto,
} from '../models/hour-entry.model';
import { ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class HourEntriesApiService {
  private readonly apiUrl = `${environment.apiUrl}/hour-entries`;

  constructor(private readonly http: HttpClient) {}

  create(payload: CreateHourEntryDto): Observable<HourEntryDto | null> {
    return this.http
      .post<ApiResponse<HourEntryDto> | HourEntryDto>(this.apiUrl, payload)
      .pipe(map((r) => this.unwrapItemTyped(r)));
  }

  update(id: string, payload: HourEntryUpdateDto): Observable<HourEntryDto | null> {
    return this.http
      .put<ApiResponse<HourEntryDto> | HourEntryDto>(`${this.apiUrl}/${id}`, payload)
      .pipe(map((r) => this.unwrapItemTyped(r)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`).pipe(map((r) => this.unwrapVoid(r)));
  }

  getMy(): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my`)
      .pipe(map((r) => this.unwrapListTyped(r)));
  }

  getMyByDate(date: string): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my/date`, { params: { date } })
      .pipe(map((r) => this.unwrapListTyped(r)));
  }

  getMyByMonth(year: number, month: number): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/my/month`, { params: { year, month } as any })
      .pipe(map((r) => this.unwrapListTyped(r)));
  }

  getByProject(projectId: string): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/project/${projectId}`)
      .pipe(map((r) => this.unwrapListTyped(r)));
  }

  getDashboardMonthly(year: number, month: number): Observable<HourEntryDashboardMonthlyDto | null> {
    return this.http
      .get<ApiResponse<HourEntryDashboardMonthlyDto> | HourEntryDashboardMonthlyDto>(`${this.apiUrl}/dashboard/monthly`, {
        params: { year, month } as any,
      })
      .pipe(map((r) => this.unwrapDashboardMonthly(r)));
  }

  getDashboardYtd(companyYear: string | number): Observable<YtdDashboardDto | null> {
    return this.http
      .get<ApiResponse<YtdDashboardDto> | YtdDashboardDto>(`${this.apiUrl}/dashboard/ytd`, { params: { companyYear } as any })
      .pipe(map((r) => this.unwrapYtd(r)));
  }

  getMyProjects(): Observable<HourEntryMyProjectDto[]> {
    return this.http
      .get<ApiResponse<HourEntryMyProjectDto[]> | HourEntryMyProjectDto[]>(`${this.apiUrl}/my/projects`)
      .pipe(map((r) => this.unwrapMyProjectsList(r)));
  }

  getMySupervisedInterns(): Observable<ProjectInternAllocationDto[]> {
    return this.http
      .get<ApiResponse<ProjectInternAllocationDto[]> | ProjectInternAllocationDto[]>(`${this.apiUrl}/my/supervised-interns`)
      .pipe(map((r) => this.unwrapProjectInternAllocationList(r)));
  }

  getPremiumPending(): Observable<HourEntryDto[]> {
    return this.http
      .get<ApiResponse<HourEntryDto[]> | HourEntryDto[]>(`${this.apiUrl}/premium/pending`)
      .pipe(map((r) => this.unwrapListTyped(r)));
  }

  approvePremium(payload: HourEntryPremiumApproveDto): Observable<void> {
    return this.http
      .put<ApiResponse<void> | void>(`${this.apiUrl}/premium/approve`, payload)
      .pipe(map((r) => this.unwrapVoid(r)));
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapListTyped(response: ApiResponse<HourEntryDto[]> | HourEntryDto[]): HourEntryDto[] {
    const raw = this.unwrapList(response as ApiResponse<unknown[]> | unknown[]);
    return raw as HourEntryDto[];
  }

  private unwrapMyProjectsList(
    response: ApiResponse<HourEntryMyProjectDto[]> | HourEntryMyProjectDto[]
  ): HourEntryMyProjectDto[] {
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapProjectInternAllocationList(
    response: ApiResponse<ProjectInternAllocationDto[]> | ProjectInternAllocationDto[]
  ): ProjectInternAllocationDto[] {
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapDashboardMonthly(
    response: ApiResponse<HourEntryDashboardMonthlyDto> | HourEntryDashboardMonthlyDto
  ): HourEntryDashboardMonthlyDto | null {
    const item = this.unwrapItem(response as ApiResponse<unknown> | unknown);
    return (item as HourEntryDashboardMonthlyDto | null) ?? null;
  }

  private unwrapYtd(response: ApiResponse<YtdDashboardDto> | YtdDashboardDto): YtdDashboardDto | null {
    const item = this.unwrapItem(response as ApiResponse<unknown> | unknown);
    return (item as YtdDashboardDto | null) ?? null;
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown | null {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }
    return response ?? null;
  }

  private unwrapItemTyped(response: ApiResponse<HourEntryDto> | HourEntryDto | null): HourEntryDto | null {
    const item = this.unwrapItem(response as ApiResponse<unknown> | unknown);
    return (item as HourEntryDto | null) ?? null;
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

