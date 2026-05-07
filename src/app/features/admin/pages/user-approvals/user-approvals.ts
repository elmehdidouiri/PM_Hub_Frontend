import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import { finalize } from 'rxjs/operators';

import { AuthApprovalsApiService, PendingUserDto } from '../../../../core/services/auth-approvals-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-user-approvals',
  standalone: false,
  templateUrl: './user-approvals.html',
  styleUrl: './user-approvals.scss',
})
export class UserApprovalsPage implements OnInit {
  private readonly api = inject(AuthApprovalsApiService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  pendingUsers: PendingUserDto[] = [];
  isLoading = true;
  errorMessage = '';
  processingId: string | null = null;

  searchTerm = '';

  ngOnInit(): void {
    this.loadPendingUsers();
  }

  get filteredUsers(): PendingUserDto[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.pendingUsers;
    return this.pendingUsers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.roleName ?? '').toLowerCase().includes(q)
    );
  }

  approve(user: PendingUserDto): void {
    this.processAction(user, true);
  }

  reject(user: PendingUserDto): void {
    const data: ConfirmationDialogData = {
      title: 'Reject Registration',
      message: `Are you sure you want to reject the registration request from ${user.fullName || user.email}?`,
      icon: 'person_remove',
      saveLabel: 'Reject Request',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'save') {
        this.processAction(user, false);
      }
    });
  }

  refresh(): void {
    this.loadPendingUsers();
  }

  private processAction(user: PendingUserDto, isApproved: boolean): void {
    if (this.processingId) return;
    this.processingId = user.id;
    this.cdr.markForCheck();

    this.api
      .approveUser({ userId: user.id, isApproved })
      .pipe(finalize(() => {
        this.processingId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          const action = isApproved ? 'approved' : 'rejected';
          this.notifications.showSuccess(
            `${user.fullName || user.email} has been ${action} successfully.`
          );
          // Remove from list
          this.pendingUsers = this.pendingUsers.filter((u) => u.id !== user.id);
          this.cdr.markForCheck();
        },
        error: () => {
          this.notifications.showError(
            `Unable to ${isApproved ? 'approve' : 'reject'} ${user.fullName || user.email}.`
          );
        },
      });
  }

  private loadPendingUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.api
      .getPendingUsers()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (users) => {
          this.pendingUsers = users;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Unable to load pending users. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }

  getInitials(user: PendingUserDto): string {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}
