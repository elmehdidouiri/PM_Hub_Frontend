import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { MAT_SNACK_BAR_DATA, MatSnackBarModule, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotificationData {
  title: string;
  message: string;
  variant: ToastVariant;
  actionUrl?: string;
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
    @Inject(MAT_SNACK_BAR_DATA) public data: ToastNotificationData,
    private readonly router: Router
  ) {}

  openAction(): void {
    const route = this.normalizeAppRoute(this.data.actionUrl);
    if (!route) {
      return;
    }

    this.snackBarRef.dismiss();
    void this.router.navigateByUrl(route);
  }

  dismiss(): void {
    this.snackBarRef.dismiss();
  }

  private normalizeAppRoute(actionUrl?: string): string | null {
    if (!actionUrl?.trim()) {
      return null;
    }

    const trimmedUrl = actionUrl.trim();

    try {
      const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
      const parsedUrl = new URL(trimmedUrl, origin);
      if (parsedUrl.origin !== origin) {
        return null;
      }

      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      return trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    }
  }
}
