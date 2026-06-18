import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { InternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';
import { ProjectService } from '../../../projects/services/project';
import { NotificationService } from '../../../../core/services/notification.service';
import { InternDetailsDialog } from '../../../users/components/intern-details-dialog/intern-details-dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

@Component({
  selector: 'app-intern-detail',
  standalone: false,
  templateUrl: './intern-detail.html',
  styleUrl: './intern-detail.scss',
})
export class InternDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly internService = inject(InternService);
  private readonly dialog = inject(MatDialog);
  private readonly projectService = inject(ProjectService);
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;

  intern: InternDto | null = null;
  statisticCards: Array<{ label: string; value: string; note?: string }> = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(() => this.loadIntern());
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  get internId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }

  get initials(): string {
    const source = this.intern?.name?.trim() || '';
    if (!source) {
      return '?';
    }

    const parts = source.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((item) => item.charAt(0)).join('').toUpperCase();
  }

  editIntern(): void {
    if (!this.internId) {
      return;
    }

    void this.router.navigate(['/interns', this.internId, 'edit']);
  }

  goBack(): void {
    void this.router.navigate(['/interns']);
  }

  viewPerformance(): void {
    if (!this.intern) return;
    
    this.isLoading = true;
    this.projectService.getProjectsPaged({ InternId: this.intern.id, pageSize: 50 }).subscribe({
      next: (res) => {
        this.runUiUpdate(() => {
          this.isLoading = false;
          const projectIds = (res.data || []).map((p) => p.id);

          const mappedIntern = {
            id: this.intern!.id,
            name: this.intern!.name,
            email: this.intern!.supervisorEmail || '',
            roleName: this.intern!.roleName,
            supervisorId: this.intern!.supervisorId,
            supervisorName: this.intern!.supervisorName,
            supervisorEmail: this.intern!.supervisorEmail
          };

          this.dialog.open(InternDetailsDialog, {
            data: { intern: mappedIntern, projectIds },
            panelClass: 'pm-dialog-panel'
          });
        });
      },
      error: (err) => {
        this.runUiUpdate(() => {
          this.isLoading = false;
          this.notifications.showError('Unable to load projects for this intern.');
        });
      }
    });
  }

  deleteIntern(): void {
    if (!this.intern) {
      return;
    }

    const data: ConfirmationDialogData = {
      title: 'Delete Intern',
      message: `Are you sure you want to delete "${this.intern.name}"? This action will permanently remove their records.`,
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
        this.executeDelete();
      }
    });
  }

  private executeDelete(): void {
    if (!this.intern) return;
    this.isLoading = true;

    this.internService.deleteIntern(this.intern.id).subscribe({
      next: () => {
        this.runUiUpdate(() => {
          this.isLoading = false;
          this.notifications.showSuccess('Intern deleted successfully.');
          this.goBack();
        });
      },
      error: (error) => {
        this.runUiUpdate(() => {
          this.isLoading = false;
          this.errorMessage = this.extractErrorMessage(error, 'Unable to delete intern.');
          this.notifications.showError(this.errorMessage);
        });
      },
    });
  }

  formatDate(value: string | null): string {
    if (!value) {
      return 'Not available';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(parsed);
  }

  private loadIntern(): void {
    if (!this.internId) {
      this.errorMessage = 'Missing intern id.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      intern: this.internService.getIntern(this.internId),
      statistics: this.internService.getStatistics(this.internId).pipe(catchError(() => of(null))),
      visualization: this.internService.getWorkVisualization(this.internId).pipe(catchError(() => of(null))),
      periodStatistics: this.internService.getPeriodStatistics(this.internId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ intern, statistics, visualization, periodStatistics }) => {
        this.runUiUpdate(() => {
          this.intern = intern;
          this.statisticCards = this.buildStatisticCards(statistics, visualization, periodStatistics);
          this.isLoading = false;
          if (!intern) {
            this.errorMessage = 'This intern could not be found from the current dataset.';
          }
        });
      },
      error: (error) => {
        this.runUiUpdate(() => {
          this.intern = null;
          this.statisticCards = [];
          this.isLoading = false;
          this.errorMessage = this.extractErrorMessage(error, 'Unable to load intern details.');
        });
      },
    });
  }

  private runUiUpdate(update: () => void): void {
    this.zone.run(() => {
      update();
      this.cdr.detectChanges();
    });
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

  private buildStatisticCards(statistics: unknown, visualization: unknown, periodStatistics: unknown): Array<{ label: string; value: string; note?: string }> {
    const stats = this.asRecord(statistics);
    const visual = this.asRecord(visualization);
    const period = this.asRecord(periodStatistics);

    const cards = [
      {
        label: 'Worked hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['totalHours', 'hoursWorked', 'workedHours', 'TotalHours', 'HoursWorked'])),
        note: 'Declared total',
      },
      {
        label: 'Allocated hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['allocatedHours', 'totalAllocatedHours', 'AllocatedHours'])),
        note: 'Current allocation',
      },
      {
        label: 'Remaining hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['remainingHours', 'RemainingHours'])),
        note: 'Estimated balance',
      },
      {
        label: 'Projects',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['projectCount', 'projectsCount', 'totalProjects', 'ProjectCount']), ''),
        note: 'Assignments',
      },
    ];

    return cards.filter((card) => card.value !== '-');
  }

  private firstNumber(...args: [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, string[]]): number | null {
    const [a, b, c, keys] = args;
    for (const source of [a, b, c]) {
      for (const key of keys) {
        const value = source[key];
        const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private formatMetric(value: number | null, suffix = ' h'): string {
    return value === null ? '-' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
