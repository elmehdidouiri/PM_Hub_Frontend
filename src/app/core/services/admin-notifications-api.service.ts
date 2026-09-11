import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface EmailNotificationToggleResponse {
  success: boolean;
  message: string;
}

export type NotificationAudienceType = 'hour-booking' | 'monthly-target' | 'inactive-users';

export interface AdminNotificationUserDto {
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
  departmentName: string;
  lastBookingDate: string;
  lastActivityDate: string;
  inactiveDays: number;
  monthlyTargetHours: number;
  bookedHours: number;
  missingHours: number;
  emailNotificationsEnabled: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationsApiService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;

  constructor(private readonly http: HttpClient) {}

  getHourBookingNotifications(): Observable<AdminNotificationUserDto[]> {
    return this.getUsers(`${this.apiUrl}/hour-booking-notifications`);
  }

  sendHourBookingReminder(userId: string): Observable<void> {
    return this.sendReminder(`${this.apiUrl}/hour-booking-notifications/${userId}/send-reminder`);
  }

  getMonthlyTargetNotifications(): Observable<AdminNotificationUserDto[]> {
    return this.getUsers(`${this.apiUrl}/monthly-target-notifications`);
  }

  sendMonthlyTargetReminder(userId: string): Observable<void> {
    return this.sendReminder(`${this.apiUrl}/monthly-target-notifications/${userId}/send-reminder`);
  }

  getInactiveUserNotifications(): Observable<AdminNotificationUserDto[]> {
    return this.getUsers(`${this.apiUrl}/inactive-user-notifications`);
  }

  sendInactiveUserReminder(userId: string): Observable<void> {
    return this.sendReminder(`${this.apiUrl}/inactive-user-notifications/${userId}/send-reminder`);
  }

  toggleEmailNotifications(userId: string, enabled: boolean): Observable<EmailNotificationToggleResponse> {
    return this.http.put<ApiResponse<EmailNotificationToggleResponse> | EmailNotificationToggleResponse>(
      `${environment.apiUrl}/users/${userId}/email-notifications`,
      { emailNotificationsEnabled: enabled }
    ).pipe(
      map((response) => {
        if (this.isApiResponse(response)) {
          return response.data as EmailNotificationToggleResponse ?? { success: response.success, message: response.message ?? '' };
        }
        return response as EmailNotificationToggleResponse;
      })
    );
  }

  private getUsers(url: string): Observable<AdminNotificationUserDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(url)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toNotificationUser(item))));
  }

  private sendReminder(url: string): Observable<void> {
    return this.http.post<ApiResponse<void> | void>(url, {}).pipe(map((response) => this.unwrapVoid(response)));
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (this.isApiResponse(response) && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    if (this.isApiResponse(response) && !response.success) {
      throw new Error(response.message || 'Unable to load notification users.');
    }
    return [];
  }

  private unwrapVoid(response: ApiResponse<void> | void): void {
    if (response === undefined) {
      return;
    }
    if (this.isApiResponse(response) && response.success) {
      return;
    }
    if (this.isApiResponse(response)) {
      throw new Error(response.message || 'Unable to send reminder.');
    }
  }

  private toNotificationUser(value: unknown): AdminNotificationUserDto {
    const record = this.asRecord(value);
    const firstName = this.str(record, ['firstName', 'FirstName']);
    const lastName = this.str(record, ['lastName', 'LastName']);
    const fullName = this.str(record, ['fullName', 'FullName', 'userName', 'UserName']) || `${firstName} ${lastName}`.trim();

    return {
      userId: this.str(record, ['userId', 'UserId', 'id', 'Id']),
      fullName: fullName || this.str(record, ['email', 'Email']) || 'Unknown user',
      email: this.str(record, ['email', 'Email']),
      roleName: this.str(record, ['roleName', 'RoleName', 'role', 'Role']),
      departmentName: this.str(record, ['departmentName', 'DepartmentName', 'department', 'Department']),
      lastBookingDate: this.str(record, ['lastBookingDate', 'LastBookingDate']),
      lastActivityDate: this.str(record, ['lastActivityDate', 'LastActivityDate']),
      inactiveDays: this.num(record, ['daysWithoutBooking', 'DaysWithoutBooking', 'inactiveDays', 'InactiveDays']),
      monthlyTargetHours: this.num(record, ['targetHours', 'TargetHours', 'monthlyTargetHours', 'MonthlyTargetHours']),
      bookedHours: this.num(record, ['bookedHours', 'BookedHours']),
      missingHours: this.num(record, ['missingHours', 'MissingHours']),
      emailNotificationsEnabled: this.bool(record, ['emailNotificationsEnabled', 'EmailNotificationsEnabled']),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private str(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private num(record: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
      const parsed = Number(record[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private bool(record: Record<string, unknown>, keys: string[], defaultValue = true): boolean {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
    return defaultValue;
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
  }
}
