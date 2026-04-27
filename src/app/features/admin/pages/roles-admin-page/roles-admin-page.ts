import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { Role } from '../../../../core/models';
import { RolesApiService } from '../../../../core/services/roles-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

type RoleFormShape = {
  name: FormControl<string>;
  description: FormControl<string>;
  isActive: FormControl<boolean>;
};

@Component({
  selector: 'app-roles-admin-page',
  standalone: false,
  templateUrl: './roles-admin-page.html',
  styleUrl: './roles-admin-page.scss',
})
export class RolesAdminPage implements OnInit {
  private readonly rolesApi = inject(RolesApiService);
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  roles: Role[] = [];
  filteredRoles: Role[] = [];
  searchTerm = '';

  isLoading = false;
  isRefreshing = false;
  errorMessage = '';

  isDrawerOpen = false;
  editingId: string | null = null;
  saving = false;
  deletingId: string | null = null;

  readonly roleForm = new FormGroup<RoleFormShape>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    description: new FormControl('', { nonNullable: true }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.isRefreshing = true;
    this.isLoading = true;
    this.errorMessage = '';

    this.rolesApi.getRoles().subscribe({
      next: (roles) => {
        this.zone.run(() => {
          this.roles = roles ?? [];
          this.applyFilter();
          this.isRefreshing = false;
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.roles = [];
          this.filteredRoles = [];
          this.isRefreshing = false;
          this.isLoading = false;
          this.errorMessage = err?.message || 'Unable to load roles';
          this.cdr.markForCheck();
        });
      },
    });
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredRoles = [...this.roles];
      return;
    }

    this.filteredRoles = this.roles.filter((role) => {
      const haystack = `${role.name} ${role.description ?? ''} ${role.id}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.roleForm.reset({ name: '', description: '', isActive: true });
    this.isDrawerOpen = true;
  }

  openEdit(role: Role): void {
    this.editingId = role.id;
    this.roleForm.reset({
      name: role.name ?? '',
      description: role.description ?? '',
      isActive: !!role.isActive,
    });
    this.isDrawerOpen = true;
  }

  closeDrawer(): void {
    if (this.saving) return;
    this.isDrawerOpen = false;
  }

  save(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const payload = {
      name: this.roleForm.controls.name.value.trim(),
      description: this.roleForm.controls.description.value.trim(),
      isActive: this.roleForm.controls.isActive.value,
    };

    this.saving = true;

    const request$ = this.editingId
      ? this.rolesApi.updateRole(this.editingId, payload)
      : this.rolesApi.createRole(payload);

    request$.subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess(this.editingId ? 'Role updated' : 'Role created');
          this.saving = false;
          this.isDrawerOpen = false;
          this.cdr.markForCheck();
          this.refresh();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to save role');
          this.saving = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  delete(role: Role): void {
    this.deletingId = role.id;
    this.rolesApi.deleteRole(role.id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess('Role deleted');
          this.deletingId = null;
          this.cdr.markForCheck();
          this.refresh();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to delete role');
          this.deletingId = null;
          this.cdr.markForCheck();
        });
      },
    });
  }

  trackByRoleId = (_: number, role: Role): string => role.id;

  get hasRoles(): boolean {
    return this.roles.length > 0;
  }

  get hasFilteredRoles(): boolean {
    return this.filteredRoles.length > 0;
  }
}

