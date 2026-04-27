import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { InternDto } from '../../models/intern.models';
import { InternService } from '../../services/intern';

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

  intern: InternDto | null = null;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadIntern();
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

    this.internService.getIntern(this.internId).subscribe({
      next: (intern) => {
        this.intern = intern;
        this.isLoading = false;
        if (!intern) {
          this.errorMessage = 'This intern could not be found from the current dataset.';
        }
      },
      error: (error) => {
        this.intern = null;
        this.isLoading = false;
        this.errorMessage = this.extractErrorMessage(error, 'Unable to load intern details.');
      },
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
}
