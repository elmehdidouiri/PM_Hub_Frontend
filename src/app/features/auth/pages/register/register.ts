import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  registerForm!: FormGroup;
  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        acceptTerms: [false, [Validators.requiredTrue]],
      },
      {
        validators: this.passwordMatchValidator
      }
    );
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: any } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    setTimeout(() => {
      this.isLoading = true;
      this.cdr.detectChanges();
    });

    const formValue = this.registerForm.value;
    const registerData = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
    };

    this.authService.register(registerData).subscribe({
      next: (user) => {
        if (user) {
          this.notificationService.showSuccess(`Welcome ${user.firstName}! Your account has been created.`);
          this.router.navigate(['/dashboard']);
          return;
        }

        this.notificationService.showSuccess(
          'Your account has been created successfully. Please wait for an administrator to approve your access before signing in.'
        );
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Register error:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  calculateProgress(): number {
    if (!this.registerForm) {
      return 0;
    }

    const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'acceptTerms'];
    const completedFields = fields.filter((field) => {
      const value = this.registerForm.get(field)?.value;

      if (typeof value === 'boolean') {
        return value;
      }

      return value !== null && value !== undefined && String(value).trim() !== '';
    }).length;

    return (completedFields / fields.length) * 100;
  }

  getErrorMessage(field: string): string {
    const control = this.registerForm.get(field);

    if (control?.hasError('required')) {
      return 'This field is required';
    }
    if (control?.hasError('email')) {
      return 'Invalid email address';
    }
    if (control?.hasError('minlength')) {
      return field.includes('Name') ? 'Minimum 2 characters' : 'Minimum 6 characters';
    }
    if (control?.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    if (control?.hasError('requiredTrue')) {
      return 'You must accept the terms';
    }

    return '';
  }
}
