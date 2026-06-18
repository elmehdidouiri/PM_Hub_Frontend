import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models';
import { CreateInternDto, InternDto, UpdateInternDto } from '../models/intern.models';

type UnknownRecord = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class InternService {
  private readonly apiUrl = `${environment.apiUrl}/interns`;

  constructor(private readonly http: HttpClient) {}

  getInterns(): Observable<InternDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(this.apiUrl)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toInternDto(item))));
  }

  getIntern(id: string): Observable<InternDto | null> {
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toInternDto(item) : null))
    );
  }

  createIntern(payload: CreateInternDto): Observable<InternDto | null> {
    return this.http.post<ApiResponse<unknown> | unknown>(this.apiUrl, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toInternDto(item) : null))
    );
  }

  updateIntern(payload: UpdateInternDto): Observable<InternDto | null> {
    return this.http.put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${payload.id}`, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toInternDto(item) : null))
    );
  }

  deleteIntern(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        if (this.isApiResponse(response)) {
          if (response.success) {
            return;
          }
          throw new Error(response.message || 'Unable to delete intern');
        }
        return;
      })
    );
  }

  getStatistics(id: string): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}/statistics`)
      .pipe(map((response) => this.unwrapItem(response)));
  }

  getWorkVisualization(id: string): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}/work-visualization`)
      .pipe(map((response) => this.unwrapItem(response)));
  }

  getPeriodStatistics(id: string): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}/period-statistics`)
      .pipe(map((response) => this.unwrapItem(response)));
  }

  getSupervisorDashboard(supervisorId: string): Observable<unknown | null> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/dashboard/supervisor/${supervisorId}`)
      .pipe(map((response) => this.unwrapItem(response)));
  }

  deleteAllData(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}/all-data`).pipe(
      map((response) => {
        if (this.isApiResponse(response)) {
          if (response.success) {
            return;
          }
          throw new Error(response.message || 'Unable to delete intern data');
        }
        return;
      })
    );
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown | null {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }

    return response ?? null;
  }

  private toInternDto(value: unknown): InternDto {
    const record = this.asRecord(value);

    return {
      id: this.readString(record, ['id']),
      name: this.readString(record, ['name']),
      roleId: this.readString(record, ['roleId']),
      roleName: this.readString(record, ['roleName']),
      supervisorId: this.readString(record, ['supervisorId']),
      supervisorName: this.readString(record, ['supervisorName']),
      supervisorEmail: this.readString(record, ['supervisorEmail']),
      createdAt: this.readString(record, ['createdAt']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
    };
  }

  private asRecord(value: unknown): UnknownRecord {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
  }

  private readString(record: UnknownRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value.trim();
      }
    }

    return '';
  }

  private readNullableString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value.trim();
      }

      if (value === null) {
        return null;
      }
    }

    return null;
  }

  private isApiResponse(value: unknown): value is ApiResponse<unknown> {
    return typeof value === 'object' && value !== null && 'success' in (value as Record<string, unknown>);
  }
}
