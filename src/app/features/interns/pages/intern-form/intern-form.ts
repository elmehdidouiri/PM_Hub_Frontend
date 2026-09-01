import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { Role } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { NavigationHistoryService } from '../../../../core/services/navigation-history.service';
import { RolesApiService } from '../../../../core/services/roles-api.service';
import { AdminUserDto, UsersApiService } from '../../../../core/services/users-api.service';
import { CreateInternDto, InternDto, UpdateInternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';

@Component({
  selector: 'app-intern-form',
  standalone: false,
  templateUrl: './intern-form.html',
  styleUrl: './intern-form.scss',
})
export class InternForm implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly internService = inject(InternService);
  private readonly rolesApi = inject(RolesApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly notifications = inject(NotificationService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    roleId: ['', Validators.required],
    supervisorId: ['', Validators.required],
  });

  roles: Role[] = [];
  supervisors: AdminUserDto[] = [];
  currentIntern: InternDto | null = null;

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadFormData();
  }

  get isEditMode(): boolean {
    return !!this.internId;
  }

  get internId(): string | null {
    return this.route.snapshot.paramMap.get('id');
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Refine intern profile' : 'Add a new intern';
  }

  get pageDescription(): string {
    return this.isEditMode
      ? 'Adjust assignment, reporting line and role ownership while keeping the experience lightweight and precise.'
      : 'Create a polished intern profile with the right role and supervisor from day one.';
  }

  get selectedRoleLabel(): string {
    const roleId = this.form.controls.roleId.value;
    return this.roles.find((role) => role.id === roleId)?.name || 'Choose a role';
  }

  get selectedSupervisorLabel(): string {
    const supervisorId = this.form.controls.supervisorId.value;
    const supervisor = this.supervisors.find((item) => (item.id || item.userId) === supervisorId);
    return supervisor ? this.getSupervisorName(supervisor) : 'Choose a supervisor';
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.isSubmitting && !this.isLoading;
  }

  submit(): void {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.form.getRawValue();
    const payload = {
      name: formValue.name.trim(),
      roleId: formValue.roleId,
      supervisorId: formValue.supervisorId,
    };

    const request$ = this.isEditMode && this.internId
      ? this.internService.updateIntern({
          id: this.internId,
          ...payload,
        } satisfies UpdateInternDto)
      : this.internService.createIntern(payload satisfies CreateInternDto);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.cdr.detectChanges();
        this.notifications.showSuccess(this.isEditMode ? 'Intern updated successfully.' : 'Intern created successfully.');
        void this.router.navigate(['/interns']);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.notifications.showError(this.extractErrorMessage(error, 'Unable to save intern.'));
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    void this.navigationHistory.back('/interns');
  }

  trackById(_: number, item: Role | AdminUserDto): string {
    return 'description' in item ? item.id : item.id || item.userId || '';
  }

  getSupervisorName(user: AdminUserDto): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email || user.userId || user.id || 'Unknown supervisor';
  }

  private loadFormData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      roles: this.rolesApi.getRoles(),
      users: this.usersApi.getUsers(),
      intern: this.internId ? this.internService.getIntern(this.internId) : of(null),
    }).subscribe({
      next: ({ roles, users, intern }) => {
        this.roles = roles ?? [];
        this.supervisors = (users ?? [])
          .filter((user) => user.isActive !== false)
          .sort((left, right) => this.getSupervisorName(left).localeCompare(this.getSupervisorName(right)));
        this.currentIntern = intern;

        if (this.isEditMode && !intern) {
          this.errorMessage = 'This intern could not be found from the current dataset.';
        }

        if (intern) {
          this.form.patchValue({
            name: intern.name,
            roleId: intern.roleId,
            supervisorId: intern.supervisorId,
          });
        } else {
          this.setDefaultInternRole();
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = this.extractErrorMessage(error, 'Unable to load intern references.');
        this.cdr.detectChanges();
      },
    });
  }

  private setDefaultInternRole(): void {
    if (this.isEditMode || this.form.controls.roleId.value) {
      return;
    }

    const internRole = this.roles.find((role) => role.name.trim().toLowerCase() === 'intern');
    if (internRole) {
      this.form.patchValue({ roleId: internRole.id });
    }
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
