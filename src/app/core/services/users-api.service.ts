import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export type UnknownRecord = Record<string, unknown>;

export interface AdminUserDto {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  roleName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  isApproved?: boolean;
  memberType?: number;
  emailNotificationsEnabled?: boolean;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsersApiService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  getUsers(): Observable<AdminUserDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(this.apiUrl)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toUserDto(item))));
  }

  getUsersByRole(roleId: string): Observable<AdminUserDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/role/${roleId}`)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toUserDto(item))));
  }

  getUser(id: string): Observable<AdminUserDto | null> {
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => (item ? this.toUserDto(item) : null))
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        if (response === undefined) {
          return;
        }
        if (this.isApiResponse(response) && response.success) {
          return;
        }
        if (this.isApiResponse(response)) {
          throw new Error(response.message || 'Unable to delete user');
        }
        return;
      })
    );
  }

  updateMemberType(id: string, memberType: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/member-type`, { memberType });
  }

  updateEmailNotifications(id: string, emailNotificationsEnabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/email-notifications`, { emailNotificationsEnabled });
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

  private toUserDto(value: unknown): AdminUserDto {
    const record = this.asRecord(value);
    return {
      id: this.readString(record, ['id']),
      userId: this.readString(record, ['userId']),
      firstName: this.readString(record, ['firstName']),
      lastName: this.readString(record, ['lastName']),
      email: this.readString(record, ['email']),
      roleId: this.readString(record, ['roleId']),
      roleName: this.readString(record, ['roleName', 'role']),
      isAdmin: this.readBoolean(record, ['isAdmin']),
      isActive: this.readBoolean(record, ['isActive']),
      isApproved: this.readBoolean(record, ['isApproved', 'approved']),
      memberType: this.readNumber(record, ['memberType']),
      emailNotificationsEnabled: this.readBoolean(record, ['emailNotificationsEnabled']),
      createdAt: this.readString(record, ['createdAt']),
    };
  }

  private asRecord(value: unknown): UnknownRecord {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
  }

  private readString(record: UnknownRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private readBoolean(record: UnknownRecord, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
    return undefined;
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }

  private readNumber(record: UnknownRecord, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number') {
        return value;
      }
    }
    return undefined;
  }
}

