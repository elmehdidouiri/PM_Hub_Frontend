import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth';
import { User } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-profile-page',
  standalone: false,
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  user: User | null = this.authService.getCurrentUser();
  isSubmittingPassword = false;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: this.passwordMatchValidator,
    }
  );

  ngOnInit(): void {
    const userId = this.user?.userId;
    if (!userId || this.authService.isAdmin(this.user)) {
      return;
    }

    this.authService.getAuthUserById(userId).subscribe({
      next: (profile) => {
        const normalized = this.toUser(profile);
        if (normalized) {
          this.user = normalized;
        }
      },
      error: () => {},
    });
  }

  get initials(): string {
    const first = this.user?.firstName?.trim().charAt(0) ?? '';
    const last = this.user?.lastName?.trim().charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || 'U';
  }

  get displayName(): string {
    const name = `${this.user?.firstName ?? ''} ${this.user?.lastName ?? ''}`.trim();
    return name || 'User';
  }

  get roleLabel(): string {
    return this.user?.roleName || (this.user?.isAdmin ? 'Administrator' : 'Member');
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const formValue = this.passwordForm.getRawValue();
    this.isSubmittingPassword = true;
    this.passwordForm.disable({ emitEvent: false });

    this.authService
      .changePassword({
        currentPassword: formValue.currentPassword ?? '',
        newPassword: formValue.newPassword ?? '',
        confirmPassword: formValue.confirmPassword ?? '',
      })
      .pipe(
        finalize(() => {
          this.isSubmittingPassword = false;
          this.passwordForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: (message) => {
          this.passwordForm.reset();
          this.notificationService.showSuccess(message);
        },
        error: () => {},
      });
  }

  getPasswordErrorMessage(field: 'currentPassword' | 'newPassword' | 'confirmPassword'): string {
    const control = this.passwordForm.get(field);

    if (control?.hasError('required')) {
      return 'This field is required';
    }
    if (control?.hasError('minlength')) {
      return 'Minimum 6 characters';
    }
    if (field === 'confirmPassword' && this.passwordForm.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }

    return '';
  }

  private passwordMatchValidator(control: AbstractControl): { passwordMismatch: true } | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }

  private toUser(value: unknown): User | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const userId = this.readString(record, ['userId', 'id', 'Id']);
    const email = this.readString(record, ['email', 'Email']);

    if (!userId && !email) {
      return null;
    }

    return {
      userId: userId || this.user?.userId || '',
      firstName: this.readString(record, ['firstName', 'FirstName']) || this.user?.firstName || '',
      lastName: this.readString(record, ['lastName', 'LastName']) || this.user?.lastName || '',
      email: email || this.user?.email || '',
      roleName: this.readString(record, ['roleName', 'RoleName', 'role', 'Role']) || this.user?.roleName || '',
      isAdmin: this.readBoolean(record, ['isAdmin', 'IsAdmin']) || this.user?.isAdmin || false,
    };
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private readBoolean(record: Record<string, unknown>, keys: string[]): boolean {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return ['true', '1', 'yes'].includes(value.toLowerCase());
      }
    }
    return false;
  }
}

