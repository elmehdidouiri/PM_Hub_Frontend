import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarModule, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotificationData {
  title: string;
  message: string;
  variant: ToastVariant;
}

@Component({
  selector: 'app-toast-notification',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, MatIconModule, MatButtonModule],
  templateUrl: './toast-notification.component.html',
  styleUrl: './toast-notification.component.scss',
})
export class ToastNotificationComponent {
  readonly config = {
    success: {
      icon: 'check_circle',
      eyebrow: 'Success'
    },
    error: {
      icon: 'cancel',
      eyebrow: 'Action needed'
    },
    info: {
      icon: 'info',
      eyebrow: 'Information'
    },
    warning: {
      icon: 'warning',
      eyebrow: 'Attention'
    }
  } as const;

  constructor(
    public snackBarRef: MatSnackBarRef<ToastNotificationComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: ToastNotificationData
  ) {}

  dismiss(): void {
    this.snackBarRef.dismiss();
  }
}
