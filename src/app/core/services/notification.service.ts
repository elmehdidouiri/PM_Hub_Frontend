import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastNotificationComponent, ToastVariant } from '../../shared/components/toast-notification/toast-notification.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private defaultConfig: MatSnackBarConfig = {
    duration: 4200,
    horizontalPosition: 'end',
    verticalPosition: 'top',
  };

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

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
