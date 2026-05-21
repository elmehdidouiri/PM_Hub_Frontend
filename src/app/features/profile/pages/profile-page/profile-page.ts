import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-profile-page',
  standalone: false,
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  readonly user = this.authService.getCurrentUser();
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
}

