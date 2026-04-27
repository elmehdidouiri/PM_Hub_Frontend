import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
import { InternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';

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

  interns: InternDto[] = [];
  filteredInterns: InternDto[] = [];

  searchTerm = '';
  isLoading = false;
  isRefreshing = false;
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
