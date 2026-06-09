import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification.service';
import { RoleService } from '../../../../core/services/role.service';
import { AdminUserDto, UsersApiService } from '../../../../core/services/users-api.service';
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
  private readonly usersApi = inject(UsersApiService);
  private readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  roles: Role[] = [];
  isLoadingRoles = false;
  isLoadingUser = false;
  isSubmitting = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;
  editingUser: AdminUserDto | null = null;

  ngOnInit(): void {
    this.initForm();
    this.loadRoles();

    if (this.isEditMode) {
      this.prepareEditMode();
      this.loadUser();
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
      ? 'Review the profile, role and access context before applying account changes.'
      : 'Create a new platform account with the right role and a clean onboarding flow.';
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.isSubmitting && !this.isLoadingRoles && !this.isLoadingUser && !this.isEditMode;
  }

  get selectedRoleLabel(): string {
    const roleId = this.form?.get('roleId')?.value;
    return this.roles.find((role) => role.id === roleId)?.name || this.editingUser?.roleName || 'Choose a role';
  }

  get displayName(): string {
    const firstName = String(this.form?.get('firstName')?.value || '').trim();
    const lastName = String(this.form?.get('lastName')?.value || '').trim();
    return `${firstName} ${lastName}`.trim() || 'User name';
  }

  get displayInitials(): string {
    const parts = this.displayName.split(' ').filter(Boolean);
    if (parts.length === 0 || this.displayName === 'User name') {
      return 'U';
    }
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  get accountStatusLabel(): string {
    if (!this.isEditMode) {
      return 'Draft profile';
    }
    if (this.editingUser?.isActive === false) {
      return 'Inactive';
    }
    if (this.editingUser?.isApproved === false) {
      return 'Pending approval';
    }
    return 'Active account';
  }

  get passwordStrengthLabel(): string {
    const password = String(this.form?.get('password')?.value || '');
    if (!password) {
      return this.isEditMode ? 'Not changed' : 'Waiting for password';
    }
    if (password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password)) {
      return 'Strong password';
    }
    if (password.length >= 6) {
      return 'Acceptable password';
    }
    return 'Too short';
  }

  get passwordStrengthPercent(): number {
    const password = String(this.form?.get('password')?.value || '');
    if (!password) {
      return 0;
    }
    let score = Math.min(password.length / 10, 1) * 45;
    score += /[A-Z]/.test(password) ? 20 : 0;
    score += /\d/.test(password) ? 20 : 0;
    score += /[^A-Za-z0-9]/.test(password) ? 15 : 0;
    return Math.min(score, 100);
  }

  controlIsInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.touched && control.invalid;
  }

  controlIsComplete(field: string): boolean {
    const control = this.form.get(field);
    const value = control?.value;
    return !!control && control.valid && value !== null && value !== undefined && String(value).trim() !== '';
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
    const fields = this.isEditMode
      ? ['firstName', 'lastName', 'email', 'roleId']
      : ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'roleId'];
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

  private prepareEditMode(): void {
    this.form.get('password')?.clearValidators();
    this.form.get('confirmPassword')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmPassword')?.updateValueAndValidity();
  }

  private loadUser(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId) {
      return;
    }

    this.isLoadingUser = true;
    this.usersApi.getUser(userId).subscribe({
      next: (user) => {
        this.editingUser = user;
        this.isLoadingUser = false;
        if (user) {
          this.form.patchValue({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            roleId: user.roleId || '',
          });
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.editingUser = null;
        this.isLoadingUser = false;
        this.errorMessage = this.extractErrorMessage(error, 'Unable to load user profile.');
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
