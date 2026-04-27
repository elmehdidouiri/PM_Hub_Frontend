import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class HourSummaryApiService {
  private readonly apiUrl = `${environment.apiUrl}/HourSummary`;

  constructor(private readonly http: HttpClient) {}

  monthly(year: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/monthly`, { params: { year } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  project(year: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/project`, { params: { year } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  user(year: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/user`, { params: { year } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  topProjects(year: number, topCount: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/top-projects`, { params: { year, topCount } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  totalHours(params: { year: number; month: number; userId?: string; projectId?: string }): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/total-hours`, { params: this.cleanParams(params) as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  breakdown(params: { year: number; month: number; userId?: string; projectId?: string }): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/breakdown`, { params: this.cleanParams(params) as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  meMonthly(year: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/me/monthly`, { params: { year } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  meProject(year: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/me/project`, { params: { year } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  meTopProjects(year: number, topCount: number): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/me/top-projects`, { params: { year, topCount } as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  meTotalHours(params: { year: number; month: number; projectId?: string }): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/me/total-hours`, { params: this.cleanParams(params) as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  meBreakdown(params: { year: number; month: number; projectId?: string }): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/me/breakdown`, { params: this.cleanParams(params) as any })
      .pipe(map((r) => this.unwrapItem(r)));
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown | null {
    if (typeof response === 'object' && response !== null && 'success' in (response as any)) {
      const api = response as ApiResponse<unknown>;
      return api.success ? (api.data ?? null) : null;
    }
    return response ?? null;
  }

  private cleanParams(params: Record<string, unknown>): Record<string, string | number | boolean> {
    return Object.entries(params).reduce<Record<string, string | number | boolean>>((accumulator, [key, value]) => {
      if (value === undefined || value === null || value === '') {
        return accumulator;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
  }
}

