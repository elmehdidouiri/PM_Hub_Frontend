import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';

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
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  users: AdminUserDto[] = [];
  filteredUsers: AdminUserDto[] = [];

  searchTerm = '';
  isLoading = false;
  isRefreshing = false;
  errorMessage = '';
  deletingUserId: string | null = null;

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

  get hasUsers(): boolean {
    return this.users.length > 0;
  }

  get hasFilteredUsers(): boolean {
    return this.filteredUsers.length > 0;
  }
}

