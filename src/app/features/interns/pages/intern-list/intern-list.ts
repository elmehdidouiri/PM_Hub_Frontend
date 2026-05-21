import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { NotificationService } from '../../../../core/services/notification.service';
import { InternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';
import { ProjectService } from '../../../projects/services/project';
import { InternDetailsDialog } from '../../../users/components/intern-details-dialog/intern-details-dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

@Component({
  selector: 'app-intern-list',
  standalone: false,
  templateUrl: './intern-list.html',
  styleUrl: './intern-list.scss',
})
export class InternList implements OnInit {
  private readonly internService = inject(InternService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly projectService = inject(ProjectService);

  interns: InternDto[] = [];
  filteredInterns: InternDto[] = [];

  searchTerm = '';
  isLoading = false;
  isRefreshing = false;
  deletingInternId: string | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.refreshInterns();
  }

  get hasInterns(): boolean {
    return this.interns.length > 0;
  }

  get hasFilteredInterns(): boolean {
    return this.filteredInterns.length > 0;
  }

  refreshInterns(): void {
    this.isLoading = true;
    this.isRefreshing = true;
    this.errorMessage = '';

    this.internService.getInterns().subscribe({
      next: (interns) => {
        this.zone.run(() => {
          this.interns = [...(interns ?? [])].sort((left, right) => left.name.localeCompare(right.name));
          this.applyFilter();
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        });
      },
      error: (error) => {
        this.zone.run(() => {
          this.interns = [];
          this.filteredInterns = [];
          this.isLoading = false;
          this.isRefreshing = false;
          this.errorMessage = this.extractErrorMessage(error, 'Unable to load interns.');
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

  openIntern(id: string): void {
    void this.router.navigate(['/interns', id]);
  }

  editIntern(id: string): void {
    void this.router.navigate(['/interns', id, 'edit']);
  }

  createIntern(): void {
    void this.router.navigate(['/interns/new']);
  }

  copyInternId(id: string): void {
    if (!id || !navigator?.clipboard) {
      return;
    }

    navigator.clipboard
      .writeText(id)
      .then(() => this.notifications.showSuccess('Intern id copied.'))
      .catch(() => this.notifications.showWarning('Unable to copy this intern id.'));
  }

  viewPerformance(intern: InternDto): void {
    if (!intern?.id) return;
    
    this.isLoading = true;
    this.projectService.getProjectsPaged({ InternId: intern.id, pageSize: 50 }).subscribe({
      next: (res) => {
        this.isLoading = false;
        const projectIds = (res.data || []).map((p) => p.id);
        
        const mappedIntern = {
          id: intern.id,
          name: intern.name,
          email: intern.supervisorEmail || '',
          roleName: intern.roleName,
          supervisorId: intern.supervisorId,
          supervisorName: intern.supervisorName,
          supervisorEmail: intern.supervisorEmail
        };

        this.dialog.open(InternDetailsDialog, {
          data: { intern: mappedIntern, projectIds },
          panelClass: 'pm-dialog-panel'
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.notifications.showError('Unable to load projects for this intern.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteIntern(intern: InternDto): void {
    if (!intern?.id || this.deletingInternId) {
      return;
    }

    const data: ConfirmationDialogData = {
      title: 'Delete Intern',
      message: `Are you sure you want to delete "${intern.name}"? This action will permanently remove their records.`,
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
        this.executeDelete(intern);
      }
    });
  }

  private executeDelete(intern: InternDto): void {
    this.deletingInternId = intern.id;

    this.internService.deleteIntern(intern.id).subscribe({
      next: () => {
        this.interns = this.interns.filter((item) => item.id !== intern.id);
        this.applyFilter();
        this.deletingInternId = null;
        this.notifications.showSuccess('Intern deleted successfully.');
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.deletingInternId = null;
        this.notifications.showError(this.extractErrorMessage(error, 'Unable to delete intern.'));
        this.cdr.markForCheck();
      },
    });
  }

  trackByInternId(_: number, intern: InternDto): string {
    return intern.id;
  }

  formatDate(value: string | null): string {
    if (!value) {
      return 'Not available';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(parsed);
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredInterns = [...this.interns];
      return;
    }

    this.filteredInterns = this.interns.filter((intern) =>
      [intern.name, intern.roleName, intern.supervisorName, intern.supervisorEmail, intern.id].join(' ').toLowerCase().includes(term)
    );
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
