import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

import { UsersApiService, AdminUserDto } from '../../../../core/services/users-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-user-list',
  standalone: false,
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList implements OnInit {
  private readonly usersApi = inject(UsersApiService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  users: AdminUserDto[] = [];
  filteredUsers: AdminUserDto[] = [];

  searchTerm = '';
  isLoading = false;
  isRefreshing = false;
  errorMessage = '';
  deletingUserId: string | null = null;
  isUpdatingMemberType: string | null = null;

  ngOnInit(): void {
    this.refreshUsers();
  }

  refreshUsers(): void {
    this.isRefreshing = true;
    this.isLoading = true;
    this.errorMessage = '';

    this.usersApi.getUsers().subscribe({
      next: (users) => {
        // HttpClient withFetch may complete outside Angular zone; ensure UI updates immediately.
        this.zone.run(() => {
          this.users = users ?? [];
          this.applyFilter();
          this.isRefreshing = false;
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.users = [];
          this.filteredUsers = [];
          this.isRefreshing = false;
          this.isLoading = false;
          this.errorMessage = err?.message || 'Unable to load users';
          this.cdr.markForCheck();
        });
      },
    });
  }

  getDisplayName(user: AdminUserDto): string {
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    return full || user.email || user.userId || user.id || 'Unknown user';
  }

  trackByUserId = (_: number, user: AdminUserDto): string => user.id || user.userId || user.email || `${_}`;

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
      this.filteredUsers = [...this.users];
      return;
    }

    this.filteredUsers = this.users.filter((user) => {
      const haystack = [
        this.getDisplayName(user),
        user.email || '',
        user.roleName || '',
        user.id || '',
        user.userId || '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }

  deleteUser(user: AdminUserDto): void {
    const id = user.id || user.userId;
    if (!id) {
      this.notifications.showError('Missing user id');
      return;
    }

    const data: ConfirmationDialogData = {
      title: 'Delete Collaborator',
      message: `Are you sure you want to delete ${this.getDisplayName(user)}? This action will permanently remove their profile and all associated data.`,
      icon: 'person_remove',
      saveLabel: 'Delete Permanently',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px',
      panelClass: 'pm-dialog-panel'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'save') {
        this.executeDelete(id);
      }
    });
  }

  private executeDelete(id: string): void {
    this.deletingUserId = id;
    this.usersApi.deleteUser(id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess('User deleted');
          this.deletingUserId = null;
          this.cdr.markForCheck();
          this.refreshUsers();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to delete user');
          this.deletingUserId = null;
          this.cdr.markForCheck();
        });
      },
    });
  }

  onMemberTypeChange(user: AdminUserDto, newMemberType: number): void {
    const id = user.id || user.userId;
    if (!id) {
      this.notifications.showError('Missing user id');
      return;
    }

    this.isUpdatingMemberType = id;
    this.usersApi.updateMemberType(id, newMemberType).subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess('Member type updated successfully');
          user.memberType = newMemberType;
          this.isUpdatingMemberType = null;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to update member type');
          this.isUpdatingMemberType = null;
          this.cdr.markForCheck();
          // Optionally revert the value or refresh
          this.refreshUsers();
        });
      }
    });
  }

  get hasUsers(): boolean {
    return this.users.length > 0;
  }

  get hasFilteredUsers(): boolean {
    return this.filteredUsers.length > 0;
  }
}

