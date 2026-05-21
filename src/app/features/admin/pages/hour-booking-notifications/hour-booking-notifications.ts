import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import {
  AdminNotificationUserDto,
  AdminNotificationsApiService,
  NotificationAudienceType,
} from '../../../../core/services/admin-notifications-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

interface NotificationAudience {
  type: NotificationAudienceType;
  label: string;
  icon: string;
  description: string;
  users: AdminNotificationUserDto[];
  errorMessage: string;
}

@Component({
  selector: 'app-hour-booking-notifications',
  standalone: false,
  templateUrl: './hour-booking-notifications.html',
  styleUrls: ['./hour-booking-notifications.scss'],
})
export class HourBookingNotificationsPage implements OnInit {
  private readonly api = inject(AdminNotificationsApiService);
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly audiences: NotificationAudience[] = [
    {
      type: 'hour-booking',
      label: 'No booking in 30 days',
      icon: 'event_busy',
      description: 'Users who have not booked any hours during the configured threshold.',
      users: [],
      errorMessage: '',
    },
    {
      type: 'monthly-target',
      label: 'Monthly target not reached',
      icon: 'track_changes',
      description: 'Users whose current month booked hours are still below their target.',
      users: [],
      errorMessage: '',
    },
    {
      type: 'inactive-users',
      label: 'Inactive users',
      icon: 'person_off',
      description: 'Users with no recent platform activity.',
      users: [],
      errorMessage: '',
    },
  ];

  activeType: NotificationAudienceType = 'hour-booking';
  searchTerm = '';
  isLoading = true;
  sendingKey: string | null = null;
  selectedUserIds: Record<NotificationAudienceType, Set<string>> = {
    'hour-booking': new Set<string>(),
    'monthly-target': new Set<string>(),
    'inactive-users': new Set<string>(),
  };

  ngOnInit(): void {
    this.refresh();
  }

  get activeAudience(): NotificationAudience {
    return this.audiences.find((audience) => audience.type === this.activeType) ?? this.audiences[0];
  }

  get filteredUsers(): AdminNotificationUserDto[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.activeAudience.users;
    }

    return this.activeAudience.users.filter((user) =>
      [user.fullName, user.email, user.roleName, user.departmentName].join(' ').toLowerCase().includes(query)
    );
  }

  get totalUsers(): number {
    return this.audiences.reduce((total, audience) => total + audience.users.length, 0);
  }

  get selectedUserCount(): number {
    return this.activeSelectedUserIds.size;
  }

  get areAllFilteredUsersSelected(): boolean {
    const visibleIds = this.getFilteredUserIds();
    return visibleIds.length > 0 && visibleIds.every((id) => this.activeSelectedUserIds.has(id));
  }

  get isFilteredSelectionIndeterminate(): boolean {
    const visibleIds = this.getFilteredUserIds();
    const selectedVisibleCount = visibleIds.filter((id) => this.activeSelectedUserIds.has(id)).length;
    return selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  private get activeSelectedUserIds(): Set<string> {
    return this.selectedUserIds[this.activeType];
  }

  refresh(): void {
    this.isLoading = true;
    this.audiences.forEach((audience) => (audience.errorMessage = ''));
    this.cdr.markForCheck();

    forkJoin({
      hourBooking: this.loadAudience('hour-booking'),
      monthlyTarget: this.loadAudience('monthly-target'),
      inactiveUsers: this.loadAudience('inactive-users'),
    })
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: (result) => {
          this.zone.run(() => {
            this.setAudienceUsers('hour-booking', result.hourBooking);
            this.setAudienceUsers('monthly-target', result.monthlyTarget);
            this.setAudienceUsers('inactive-users', result.inactiveUsers);
            this.cdr.markForCheck();
          });
        },
        error: () => this.cdr.markForCheck(),
      });
  }

  selectAudience(type: NotificationAudienceType): void {
    this.activeType = type;
    this.searchTerm = '';
  }

  isUserSelected(userId: string): boolean {
    return this.activeSelectedUserIds.has(userId);
  }

  toggleUserSelection(userId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.activeSelectedUserIds.add(userId);
    } else {
      this.activeSelectedUserIds.delete(userId);
    }
  }

  toggleSelectAllFiltered(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const visibleIds = this.getFilteredUserIds();

    if (checked) {
      visibleIds.forEach((id) => this.activeSelectedUserIds.add(id));
      return;
    }

    visibleIds.forEach((id) => this.activeSelectedUserIds.delete(id));
  }

  clearSelection(): void {
    this.activeSelectedUserIds.clear();
  }

  sendReminder(user: AdminNotificationUserDto): void {
    if (!user.userId || this.sendingKey) {
      return;
    }

    const type = this.activeType;
    this.sendingKey = this.buildSendingKey(type, user.userId);
    this.sendReminderRequest(type, user.userId)
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.sendingKey = null;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: () => {
          this.zone.run(() => {
            this.notifications.showSuccess(`Reminder sent to ${user.fullName || user.email}.`);
            this.removeUser(type, user.userId);
            this.cdr.markForCheck();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.notifications.showError(`Unable to send reminder to ${user.fullName || user.email}.`);
            this.cdr.markForCheck();
          });
        },
      });
  }

  sendSelectedReminders(): void {
    const type = this.activeType;
    const selectedIds = new Set(this.activeSelectedUserIds);
    const selectedUsers = this.activeAudience.users.filter((user) => user.userId && selectedIds.has(user.userId));

    if (!selectedUsers.length) {
      this.notifications.showError('Select at least one user to send reminders.');
      this.clearSelection();
      return;
    }

    this.sendingKey = this.buildBulkSendingKey(type);
    forkJoin(
      selectedUsers.map((user) =>
        this.sendReminderRequest(type, user.userId).pipe(
          map(() => ({ ok: true, user })),
          catchError(() => of({ ok: false, user }))
        )
      )
    )
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.sendingKey = null;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe((results) => {
        this.zone.run(() => {
          const sentUsers = results.filter((result) => result.ok).map((result) => result.user);
          const failedCount = results.length - sentUsers.length;

          sentUsers.forEach((user) => {
            this.removeUser(type, user.userId);
            this.selectedUserIds[type].delete(user.userId);
          });

          if (sentUsers.length) {
            this.notifications.showSuccess(`${sentUsers.length} reminder${sentUsers.length > 1 ? 's' : ''} sent.`);
          }
          if (failedCount) {
            this.notifications.showError(`${failedCount} reminder${failedCount > 1 ? 's' : ''} could not be sent.`);
          }

          this.cdr.markForCheck();
        });
      });
  }

  isSending(user: AdminNotificationUserDto): boolean {
    return (
      this.sendingKey === this.buildBulkSendingKey(this.activeType) ||
      this.sendingKey === this.buildSendingKey(this.activeType, user.userId)
    );
  }

  getInitials(user: AdminNotificationUserDto): string {
    const parts = (user.fullName || user.email || '?').trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return `${first}${second}`.toUpperCase() || '?';
  }

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private sendReminderRequest(type: NotificationAudienceType, userId: string) {
    if (type === 'monthly-target') {
      return this.api.sendMonthlyTargetReminder(userId);
    }
    if (type === 'inactive-users') {
      return this.api.sendInactiveUserReminder(userId);
    }
    return this.api.sendHourBookingReminder(userId);
  }

  private loadAudience(type: NotificationAudienceType) {
    const request =
      type === 'monthly-target'
        ? this.api.getMonthlyTargetNotifications()
        : type === 'inactive-users'
          ? this.api.getInactiveUserNotifications()
          : this.api.getHourBookingNotifications();

    return request.pipe(
      catchError(() => {
        this.setAudienceError(type, 'Unable to load this notification list.');
        return of([]);
      })
    );
  }

  private setAudienceUsers(type: NotificationAudienceType, users: AdminNotificationUserDto[]): void {
    const audience = this.audiences.find((item) => item.type === type);
    if (audience) {
      audience.users = users ?? [];
      this.pruneSelection(type);
    }
  }

  private setAudienceError(type: NotificationAudienceType, message: string): void {
    const audience = this.audiences.find((item) => item.type === type);
    if (audience) {
      audience.errorMessage = message;
    }
  }

  private removeUser(type: NotificationAudienceType, userId: string): void {
    const audience = this.audiences.find((item) => item.type === type);
    if (audience) {
      audience.users = audience.users.filter((user) => user.userId !== userId);
      this.selectedUserIds[type].delete(userId);
    }
  }

  private buildSendingKey(type: NotificationAudienceType, userId: string): string {
    return `${type}:${userId}`;
  }

  private buildBulkSendingKey(type: NotificationAudienceType): string {
    return `${type}:bulk`;
  }

  private getFilteredUserIds(): string[] {
    return this.filteredUsers.map((user) => user.userId).filter(Boolean);
  }

  private pruneSelection(type: NotificationAudienceType): void {
    const audience = this.audiences.find((item) => item.type === type);
    const currentIds = new Set((audience?.users ?? []).map((user) => user.userId).filter(Boolean));

    this.selectedUserIds[type].forEach((userId) => {
      if (!currentIds.has(userId)) {
        this.selectedUserIds[type].delete(userId);
      }
    });
  }
}
