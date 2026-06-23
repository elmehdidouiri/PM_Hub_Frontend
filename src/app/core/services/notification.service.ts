import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { Observable, Subject, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastNotificationComponent, ToastVariant } from '../../shared/components/toast-notification/toast-notification.component';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { StorageService } from './storage.service';

export interface HeaderNotificationQueryParams {
  dueSoonDays?: number;
  recentUpdatedDays?: number;
  lowProgressThreshold?: number;
  maxItems?: number;
}

export interface HeaderNotificationActionResult {
  affectedCount: number;
  updatedAt: string;
}

export interface HeaderNotificationSummary {
  totalCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  generatedAt: string;
  groups: HeaderNotificationGroup[];
  items: HeaderNotification[];
}

export interface HeaderNotificationGroup {
  key: string;
  label: string;
  count: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface HeaderNotification {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  groupKey: string;
  groupLabel: string;
  title: string;
  message: string;
  createdAt: string;
  occurredAt?: string;
  targetType: 'Project' | 'User' | 'Intern' | 'Roadblock';
  targetId: string;
  projectId?: string;
  actionUrl: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
}

export interface BookingActivityNotification {
  eventType: 'created' | 'updated' | 'deleted';
  hourEntryId: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  projectId?: string;
  activityTarget: string;
  category: number;
  allocationType: number;
  bookingType: 'Normal' | 'Premium';
  bookingDate: string;
  occurredAtUtc: string;
  totalHours: number;
  executionHours: number;
  supervisionHours: number;
  processHours: number;
  managementHours: number;
  rAndDHours: number;
  workshopHours: number;
  otherHours: number;
  internManagementHours: number;
  notes?: string;
  message: string;
  actionUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly headerApiUrl = `${environment.apiUrl}/notifications/header`;
  private readonly defaultHeaderNotificationParams: Required<HeaderNotificationQueryParams> = {
    dueSoonDays: 14,
    recentUpdatedDays: 7,
    lowProgressThreshold: 70,
    maxItems: 50,
  };
  private defaultConfig: MatSnackBarConfig = {
    duration: 4200,
    horizontalPosition: 'end',
    verticalPosition: 'top',
  };
  private readonly bookingActivityNotificationSubject = new Subject<HeaderNotification>();
  readonly bookingActivityNotification$ = this.bookingActivityNotificationSubject.asObservable();

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private storageService: StorageService
  ) {}

  getHeaderNotifications(
    params?: HeaderNotificationQueryParams
  ): Observable<ApiResponse<HeaderNotificationSummary>> {
    if (!this.hasJwtToken()) {
      return throwError(() => new Error('Authentication token is missing.'));
    }

    return this.http.get<ApiResponse<HeaderNotificationSummary> | unknown>(this.headerApiUrl, {
      params: this.buildHeaderNotificationParams(params),
    }).pipe(map((response) => this.toHeaderNotificationResponse(response)));
  }

  markAllHeaderNotificationsAsRead(
    params?: HeaderNotificationQueryParams
  ): Observable<ApiResponse<HeaderNotificationActionResult>> {
    if (!this.hasJwtToken()) {
      return throwError(() => new Error('Authentication token is missing.'));
    }

    return this.http.post<ApiResponse<HeaderNotificationActionResult>>(
      `${this.headerApiUrl}/mark-all-as-read`,
      {},
      {
        params: this.buildHeaderNotificationParams(params, false),
      }
    );
  }

  clearHeaderNotifications(
    params?: HeaderNotificationQueryParams
  ): Observable<ApiResponse<HeaderNotificationActionResult>> {
    if (!this.hasJwtToken()) {
      return throwError(() => new Error('Authentication token is missing.'));
    }

    return this.http.post<ApiResponse<HeaderNotificationActionResult>>(
      `${this.headerApiUrl}/clear`,
      {},
      {
        params: this.buildHeaderNotificationParams(params, false),
      }
    );
  }

  resetHeaderNotifications(): Observable<ApiResponse<HeaderNotificationActionResult>> {
    if (!this.hasJwtToken()) {
      return throwError(() => new Error('Authentication token is missing.'));
    }

    return this.http.post<ApiResponse<HeaderNotificationActionResult>>(
      `${this.headerApiUrl}/reset`,
      {}
    );
  }

  showSuccess(message: string): void {
    this.openToast('Saved successfully', message, 'success', 3400);
  }

  showError(message: string): void {
    this.openToast('Something went wrong', message, 'error', 5200);
  }

  showInfo(message: string, actionUrl?: string): void {
    this.openToast('Update', message, 'info', 3600, actionUrl);
  }

  showWarning(message: string): void {
    this.openToast('Please review', message, 'warning', 4200);
  }

  receiveBookingActivityNotification(payload: unknown): void {
    const notification = this.toBookingActivityHeaderNotification(payload);

    this.bookingActivityNotificationSubject.next(notification);
    this.openToast('Booking activity', notification.message, 'info', 5200, notification.actionUrl);
  }

  private openToast(
    title: string,
    message: string,
    variant: ToastVariant,
    duration: number,
    actionUrl?: string
  ): void {
    this.snackBar.openFromComponent(ToastNotificationComponent, {
      ...this.defaultConfig,
      duration,
      panelClass: ['pmhub-toast-panel'],
      data: {
        title,
        message,
        variant,
        actionUrl,
      }
    });
  }

  private toBookingActivityHeaderNotification(value: unknown): HeaderNotification {
    const record = this.asRecord(value);
    const occurredAt = this.str(record, ['occurredAtUtc', 'OccurredAtUtc']) || new Date().toISOString();
    const hourEntryId = this.str(record, ['hourEntryId', 'HourEntryId']);
    const userId = this.str(record, ['userId', 'UserId']);
    const projectId = this.str(record, ['projectId', 'ProjectId']) || undefined;
    const eventType = this.str(record, ['eventType', 'EventType']) || 'updated';
    const message = this.str(record, ['message', 'Message']) || 'A booking activity was received.';

    return {
      id: `booking-${hourEntryId || userId || 'activity'}-${eventType}-${occurredAt}`,
      type: `BookingActivity.${eventType}`,
      severity: 'info',
      groupKey: 'booking-activities',
      groupLabel: 'Booking activities',
      title: this.bookingActivityTitle(eventType),
      message,
      createdAt: occurredAt,
      occurredAt,
      targetType: projectId ? 'Project' : 'User',
      targetId: projectId || userId || hourEntryId,
      projectId,
      actionUrl: this.str(record, ['actionUrl', 'ActionUrl']),
      isRead: false,
      metadata: record,
    };
  }

  private bookingActivityTitle(eventType: string): string {
    switch (eventType.toLowerCase()) {
      case 'created':
        return 'Booking created';
      case 'deleted':
        return 'Booking deleted';
      default:
        return 'Booking updated';
    }
  }

  private buildHeaderNotificationParams(
    params?: HeaderNotificationQueryParams,
    includeMaxItems = true
  ): HttpParams {
    const merged = {
      ...this.defaultHeaderNotificationParams,
      ...params,
    };

    let httpParams = new HttpParams()
      .set('dueSoonDays', String(merged.dueSoonDays))
      .set('recentUpdatedDays', String(merged.recentUpdatedDays))
      .set('lowProgressThreshold', String(merged.lowProgressThreshold));

    if (includeMaxItems) {
      httpParams = httpParams.set('maxItems', String(merged.maxItems));
    }

    return httpParams;
  }

  private hasJwtToken(): boolean {
    return Boolean(this.storageService.getItem<string>(environment.tokenKey));
  }

  private toHeaderNotificationResponse(response: unknown): ApiResponse<HeaderNotificationSummary> {
    const record = this.asRecord(response);
    const data = this.asRecord(record['data'] ?? record['Data']);

    return {
      success: this.bool(record, ['success', 'Success'], true),
      message: this.str(record, ['message', 'Message']) || null,
      errors: (record['errors'] ?? record['Errors'] ?? null) as ApiResponse<HeaderNotificationSummary>['errors'],
      data: this.toHeaderNotificationSummary(data),
    };
  }

  private toHeaderNotificationSummary(record: Record<string, unknown>): HeaderNotificationSummary {
    const items = this.array(record, ['items', 'Items']).map((item) => this.toHeaderNotification(item));
    const groups = this.array(record, ['groups', 'Groups']).map((group) => this.toHeaderNotificationGroup(group));

    return {
      totalCount: this.num(record, ['totalCount', 'TotalCount'], items.length),
      criticalCount: this.num(record, ['criticalCount', 'CriticalCount'], items.filter((item) => item.severity === 'critical').length),
      warningCount: this.num(record, ['warningCount', 'WarningCount'], items.filter((item) => item.severity === 'warning').length),
      infoCount: this.num(record, ['infoCount', 'InfoCount'], items.filter((item) => item.severity === 'info').length),
      generatedAt: this.str(record, ['generatedAt', 'GeneratedAt']) || new Date().toISOString(),
      groups,
      items,
    };
  }

  private toHeaderNotificationGroup(value: unknown): HeaderNotificationGroup {
    const record = this.asRecord(value);
    return {
      key: this.str(record, ['key', 'Key']),
      label: this.str(record, ['label', 'Label']) || 'Notifications',
      count: this.num(record, ['count', 'Count']),
      criticalCount: this.num(record, ['criticalCount', 'CriticalCount']),
      warningCount: this.num(record, ['warningCount', 'WarningCount']),
      infoCount: this.num(record, ['infoCount', 'InfoCount']),
    };
  }

  private toHeaderNotification(value: unknown): HeaderNotification {
    const record = this.asRecord(value);
    const severity = this.notificationSeverity(this.str(record, ['severity', 'Severity']));

    return {
      id: this.str(record, ['id', 'Id']),
      type: this.str(record, ['type', 'Type']),
      severity,
      groupKey: this.str(record, ['groupKey', 'GroupKey']) || 'notifications',
      groupLabel: this.str(record, ['groupLabel', 'GroupLabel']) || 'Notifications',
      title: this.str(record, ['title', 'Title']) || 'Notification',
      message: this.str(record, ['message', 'Message']),
      createdAt: this.str(record, ['createdAt', 'CreatedAt']) || new Date().toISOString(),
      occurredAt: this.str(record, ['occurredAt', 'OccurredAt']) || undefined,
      targetType: this.notificationTargetType(this.str(record, ['targetType', 'TargetType'])),
      targetId: this.str(record, ['targetId', 'TargetId']),
      projectId: this.str(record, ['projectId', 'ProjectId']) || undefined,
      actionUrl: this.str(record, ['actionUrl', 'ActionUrl']),
      isRead: this.bool(record, ['isRead', 'IsRead'], false),
      metadata: this.asRecord(record['metadata'] ?? record['Metadata']),
    };
  }

  private notificationSeverity(value: string): HeaderNotification['severity'] {
    const normalized = value.toLowerCase();
    return normalized === 'critical' || normalized === 'warning' || normalized === 'info'
      ? normalized
      : 'info';
  }

  private notificationTargetType(value: string): HeaderNotification['targetType'] {
    const normalized = value.toLowerCase();
    if (normalized === 'user') {
      return 'User';
    }
    if (normalized === 'intern') {
      return 'Intern';
    }
    if (normalized === 'roadblock') {
      return 'Roadblock';
    }
    return 'Project';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private array(record: Record<string, unknown>, keys: string[]): unknown[] {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }

  private str(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value.trim();
      }
    }
    return '';
  }

  private num(record: Record<string, unknown>, keys: string[], fallback = 0): number {
    for (const key of keys) {
      const parsed = Number(record[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private bool(record: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
    }
    return fallback;
  }

  showErrorDialog(title: string, errors: string[]): void {
    import('../../shared/components/error-dialog/error-dialog.component').then(
      ({ ErrorDialogComponent }) => {
        this.dialog.open(ErrorDialogComponent, {
          width: '460px',
          maxWidth: 'calc(100vw - 24px)',
          panelClass: 'pmhub-error-dialog-panel',
          data: {
            title,
            errors
          }
        });
      }
    );
  }
}
