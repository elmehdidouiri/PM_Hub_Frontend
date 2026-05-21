import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastNotificationComponent, ToastVariant } from '../../shared/components/toast-notification/toast-notification.component';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

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

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly headerApiUrl = `${environment.apiUrl}/notifications/header`;
  private defaultConfig: MatSnackBarConfig = {
    duration: 4200,
    horizontalPosition: 'end',
    verticalPosition: 'top',
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  getHeaderNotifications() {
    return this.http.get<ApiResponse<HeaderNotificationSummary>>(this.headerApiUrl, {
      params: {
        dueSoonDays: 14,
        recentUpdatedDays: 7,
        lowProgressThreshold: 70,
        maxItems: 50,
      },
    });
  }

  showSuccess(message: string): void {
    this.openToast('Saved successfully', message, 'success', 3400);
  }

  showError(message: string): void {
    this.openToast('Something went wrong', message, 'error', 5200);
  }

  showInfo(message: string): void {
    this.openToast('Update', message, 'info', 3600);
  }

  showWarning(message: string): void {
    this.openToast('Please review', message, 'warning', 4200);
  }

  private openToast(title: string, message: string, variant: ToastVariant, duration: number): void {
    this.snackBar.openFromComponent(ToastNotificationComponent, {
      ...this.defaultConfig,
      duration,
      panelClass: ['pmhub-toast-panel'],
      data: {
        title,
        message,
        variant
      }
    });
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
