import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { UnknownRecord } from './users-api.service';

export interface AdminDto {
  id?: string;
  adminId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AdminsApiService {
  private readonly apiUrl = `${environment.apiUrl}/admins`;

  constructor(private readonly http: HttpClient) {}

  getAdmins(): Observable<AdminDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(this.apiUrl)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toAdminDto(item))));
  }

  getAdmin(id: string): Observable<AdminDto | null> {
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toAdminDto(item) : null))
    );
  }

  createAdmin(payload: UnknownRecord): Observable<AdminDto | null> {
    return this.http.post<ApiResponse<unknown> | unknown>(this.apiUrl, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toAdminDto(item) : null))
    );
  }

  updateAdmin(id: string, payload: UnknownRecord): Observable<AdminDto | null> {
    return this.http.put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toAdminDto(item) : null))
    );
  }

  deleteAdmin(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        if (response === undefined) return;
        if (this.isApiResponse(response) && response.success) return;
        if (this.isApiResponse(response)) {
          throw new Error(response.message || 'Unable to delete admin');
        }
        return;
      })
    );
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown | null {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }
    return response ?? null;
  }

  private toAdminDto(value: unknown): AdminDto {
    const record = this.asRecord(value);
    return {
      id: this.readString(record, ['id']),
      adminId: this.readString(record, ['adminId']),
      firstName: this.readString(record, ['firstName']),
      lastName: this.readString(record, ['lastName']),
      email: this.readString(record, ['email']),
      createdAt: this.readString(record, ['createdAt']),
      isActive: this.readBoolean(record, ['isActive']),
    };
  }

  private asRecord(value: unknown): UnknownRecord {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
  }

  private readString(record: UnknownRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  private readBoolean(record: UnknownRecord, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') return value;
    }
    return undefined;
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }
}

