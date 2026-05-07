import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification.service';

type ResetStep = 'email' | 'code' | 'password' | 'done';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  standalone: false,
  host: {
    ngSkipHydration: 'true',
  },
})
export class ForgotPassword {
  emailForm: FormGroup;
  codeForm: FormGroup;
  passwordForm: FormGroup;
  isLoading = false;
  currentStep: ResetStep = 'email';
  resetToken = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.passwordForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  requestCode(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.emailForm.disable({ emitEvent: false });

    this.authService
      .forgotPassword(this.emailForm.value)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.emailForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: (message) => {
          this.currentStep = 'code';
          this.notificationService.showSuccess(message);
        },
        error: () => {},
      });
  }

  verifyCode(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.codeForm.disable({ emitEvent: false });

    this.authService
      .verifyResetCode({
        email: this.emailForm.get('email')?.value,
        code: this.codeForm.get('code')?.value,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.codeForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: (resetToken) => {
          this.resetToken = resetToken;
          this.currentStep = 'password';
          this.notificationService.showSuccess('Code verified. You can set a new password.');
        },
        error: () => {},
      });
  }

  resetPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.passwordForm.disable({ emitEvent: false });

    this.authService
      .resetPassword({
        email: this.emailForm.get('email')?.value,
        resetToken: this.resetToken,
        newPassword: this.passwordForm.get('newPassword')?.value,
        confirmPassword: this.passwordForm.get('confirmPassword')?.value,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.passwordForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: (message) => {
          this.currentStep = 'done';
          this.notificationService.showSuccess(message);
        },
        error: () => {},
      });
  }

  resendCode(): void {
    this.codeForm.reset();
    this.requestCode();
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  passwordMatchValidator(control: AbstractControl): { passwordMismatch: true } | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }

  getEmailErrorMessage(): string {
    const control = this.emailForm.get('email');

    if (control?.hasError('required')) {
      return 'Email is required';
    }
    if (control?.hasError('email')) {
      return 'Invalid email address';
    }

    return '';
  }

  getCodeErrorMessage(): string {
    const control = this.codeForm.get('code');

    if (control?.hasError('required')) {
      return 'Code is required';
    }
    if (control?.hasError('pattern')) {
      return 'Enter the 6-digit code';
    }

    return '';
  }

  getPasswordErrorMessage(field: 'newPassword' | 'confirmPassword'): string {
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
}
