import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification.service';
import { RoleService } from '../../../../core/services/role.service';
import { Role } from '../../../../core/models';

@Component({
  selector: 'app-user-form',
  standalone: false,
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  roles: Role[] = [];
  isLoadingRoles = false;
  isSubmitting = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  ngOnInit(): void {
    this.initForm();
    this.loadRoles();

    if (this.isEditMode) {
      this.errorMessage = 'User update is not wired yet on this page. Creation is available now.';
    }
  }

  get isEditMode(): boolean {
    return !!this.route.snapshot.paramMap.get('id');
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit user' : 'Create user';
  }

  get pageDescription(): string {
    return this.isEditMode
      ? 'This screen is prepared visually, but only user creation is connected right now.'
      : 'Create a new platform account with the right role and a clean onboarding flow.';
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.isSubmitting && !this.isLoadingRoles && !this.isEditMode;
  }

  get selectedRoleLabel(): string {
    const roleId = this.form?.get('roleId')?.value;
    return this.roles.find((role) => role.id === roleId)?.name || 'Choose a role';
  }

  submit(): void {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const value = this.form.getRawValue();
    this.authService
      .register({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: value.email.trim(),
        password: value.password,
      })
      .subscribe({
        next: (user) => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          if (user) {
            this.notifications.showSuccess(`User ${user.firstName} created successfully.`);
          } else {
            this.notifications.showSuccess('User created successfully. Approval may still be required.');
          }
          void this.router.navigate(['/users']);
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorMessage = this.extractErrorMessage(error, 'Unable to create user.');
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    void this.router.navigate(['/users']);
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);

    if (control?.hasError('required')) {
      return 'This field is required';
    }
    if (control?.hasError('email')) {
      return 'Enter a valid email address';
    }
    if (control?.hasError('minlength')) {
      return field === 'password' ? 'Minimum 6 characters' : 'Minimum 2 characters';
    }
    if (field === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }

    return '';
  }

  calculateProgress(): number {
    const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'roleId'];
    const completed = fields.filter((field) => {
      const value = this.form.get(field)?.value;
      return value !== null && value !== undefined && String(value).trim() !== '';
    }).length;

    return (completed / fields.length) * 100;
  }

  private initForm(): void {
    this.form = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        roleId: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  private loadRoles(): void {
    this.isLoadingRoles = true;
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles ?? [];
        this.isLoadingRoles = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.roles = [];
        this.isLoadingRoles = false;
        this.errorMessage = this.extractErrorMessage(error, 'Unable to load roles.');
        this.cdr.markForCheck();
      },
    });
  }

  private passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      error?: { errors?: string[]; message?: string };
      message?: string;
    };

    if (Array.isArray(apiError?.error?.errors) && apiError.error.errors.length > 0) {
      return apiError.error.errors[0];
    }

    if (apiError?.error?.message) {
      return apiError.error.message;
    }

    if (apiError?.message) {
      return apiError.message;
    }

    return fallback;
  }
}
