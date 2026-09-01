import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { InternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';
import { ProjectService } from '../../../projects/services/project';
import { NotificationService } from '../../../../core/services/notification.service';
import { NavigationHistoryService } from '../../../../core/services/navigation-history.service';
import { InternDetailsDialog } from '../../../users/components/intern-details-dialog/intern-details-dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

interface DetailSection {
  title: string;
  icon: string;
  items: Array<{ label: string; value: string }>;
}

interface StatisticCard {
  label: string;
  value: string;
  note?: string;
  icon: string;
  tone: 'amber' | 'blue' | 'green' | 'violet';
}

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
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;

  intern: InternDto | null = null;
  statisticCards: StatisticCard[] = [];
  detailSections: DetailSection[] = [];
  periodLabel = '';
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
    void this.navigationHistory.back('/interns');
  }

  viewPerformance(): void {
    if (!this.intern) return;
    
    this.isLoading = true;
    this.projectService.getProjectsPaged({ InternId: this.intern.id, pageSize: 50 }, { ignoreGlobalError: true }).subscribe({
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

    const currentPeriod = this.getCurrentPeriod();
    this.periodLabel = this.formatPeriod(currentPeriod);

    forkJoin({
      intern: this.internService.getIntern(this.internId),
      statistics: this.internService.getStatistics(this.internId).pipe(catchError(() => of(null))),
      visualization: this.internService.getWorkVisualization(this.internId).pipe(catchError(() => of(null))),
      periodStatistics: this.internService.getPeriodStatistics(this.internId, currentPeriod).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ intern, statistics, visualization, periodStatistics }) => {
        this.runUiUpdate(() => {
          this.intern = intern;
          this.statisticCards = this.buildStatisticCards(statistics, visualization, periodStatistics);
          this.detailSections = intern ? this.buildDetailSections(intern) : [];
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
          this.detailSections = [];
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

  private getCurrentPeriod(): { year: number; month: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  private formatPeriod(period: { year: number; month: number }): string {
    const date = new Date(period.year, period.month - 1, 1);
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
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

  private buildDetailSections(intern: InternDto): DetailSection[] {
    const sections: DetailSection[] = [
      {
        title: 'Assignment',
        icon: 'work_outline',
        items: [
          { label: 'Role', value: intern.roleName || 'Role not set' },
          { label: 'Supervisor', value: intern.supervisorName || 'Supervisor not set' },
          { label: 'Supervisor email', value: intern.supervisorEmail || 'Email not available' },
        ],
      },
      {
        title: 'Timeline',
        icon: 'event_available',
        items: [
          { label: 'Created', value: this.formatDate(intern.createdAt) },
          { label: 'Last updated', value: this.formatDate(intern.updatedAt) },
        ],
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.value && item.value !== '-'),
      }))
      .filter((section) => section.items.length > 0);
  }

  private buildStatisticCards(statistics: unknown, visualization: unknown, periodStatistics: unknown): StatisticCard[] {
    const stats = this.asRecord(statistics);
    const visual = this.asRecord(visualization);
    const period = this.asRecord(periodStatistics);

    const cards: StatisticCard[] = [
      {
        label: 'Worked hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['totalHours', 'hoursWorked', 'workedHours', 'TotalHours', 'HoursWorked'])),
        note: 'Declared total',
        icon: 'schedule',
        tone: 'blue',
      },
      {
        label: 'Allocated hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['allocatedHours', 'totalAllocatedHours', 'AllocatedHours'])),
        note: 'Current allocation',
        icon: 'assignment',
        tone: 'amber',
      },
      {
        label: 'Remaining hours',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['remainingHours', 'RemainingHours'])),
        note: 'Estimated balance',
        icon: 'hourglass_top',
        tone: 'green',
      },
      {
        label: 'Projects',
        value: this.formatMetric(this.firstNumber(stats, visual, period, ['projectCount', 'projectsCount', 'totalProjects', 'ProjectCount']), ''),
        note: 'Assignments',
        icon: 'account_tree',
        tone: 'violet',
      },
    ];

    const dynamicCards = this.buildDynamicMetricCards([stats, visual, period], new Set(cards.map((card) => card.label.toLowerCase())));
    return [...cards, ...dynamicCards].filter((card) => card.value !== '-');
  }

  private buildDynamicMetricCards(sources: Record<string, unknown>[], usedLabels: Set<string>): StatisticCard[] {
    const excluded = new Set([
      'id', 'internid', 'roleid', 'supervisorid', 'userid', 'projectid',
      'year', 'month', 'totalhours', 'hoursworked', 'workedhours', 'allocatedhours',
      'totalallocatedhours', 'remaininghours', 'projectcount', 'projectscount', 'totalprojects',
    ]);
    const cards: StatisticCard[] = [];

    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        const normalizedKey = key.toLowerCase();
        if (excluded.has(normalizedKey) || normalizedKey.endsWith('id')) {
          continue;
        }

        const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
        if (!Number.isFinite(parsed)) {
          continue;
        }

        const label = this.humanizeKey(key);
        if (usedLabels.has(label.toLowerCase())) {
          continue;
        }

        usedLabels.add(label.toLowerCase());
        cards.push({
          label,
          value: this.formatMetric(parsed, key.toLowerCase().includes('hour') ? ' h' : ''),
          note: 'Live metric',
          icon: 'insights',
          tone: 'blue',
        });
      }
    }

    return cards.slice(0, 4);
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (value) => value.toUpperCase());
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
