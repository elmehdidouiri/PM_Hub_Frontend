import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';

import { ProjectSummaryDto } from '../../../projects/models';
import { ProjectService } from '../../../projects/services/project';

interface DistributionRow {
  label: string;
  count: number;
}

@Component({
  selector: 'app-project-overview-report-page',
  standalone: false,
  templateUrl: './project-overview-report-page.html',
  styleUrl: './project-overview-report-page.scss',
})
export class ProjectOverviewReportPage implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly cdr = inject(ChangeDetectorRef);

  isLoading = false;
  errorMessage = '';
  projects: ProjectSummaryDto[] = [];
  statusRows: DistributionRow[] = [];
  phaseRows: DistributionRow[] = [];
  delayedProjects = 0;
  totalEstimatedHours = 0;
  totalActualHours = 0;

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.projectService.getProjects().pipe(
      timeout(10000),
      catchError((error) => {
        console.error('Error loading project overview report:', error);
        this.errorMessage = error?.message || 'Unable to load project report.';
        return of([]);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (projects) => {
        try {
          const raw = projects as any;
          const list: ProjectSummaryDto[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.projects)
            ? raw.projects
            : Array.isArray(raw?.result)
            ? raw.result
            : [];

          this.projects = list;
          this.statusRows = this.buildDistribution(this.projects, (project) => this.label(project?.statusLabel, project?.status));
          this.phaseRows = this.buildDistribution(this.projects, (project) => this.label(project?.phaseLabel, project?.phase));
          this.delayedProjects = this.projects.filter((project) => Boolean(project?.isDelayed)).length;
          this.totalEstimatedHours = this.projects.reduce((sum, project) => sum + Number(project?.estimatedHours ?? 0), 0);
          this.totalActualHours = this.projects.reduce((sum, project) => sum + Number(project?.actualHours ?? 0), 0);
        } catch (err) {
          console.error('Error parsing project report data:', err);
          this.errorMessage = 'Failed to display project report data.';
        }
      },
    });
  }

  get hasProjects(): boolean {
    return Array.isArray(this.projects) && this.projects.length > 0;
  }

  trackByLabel(_: number, row: DistributionRow): string {
    return row.label;
  }

  private buildDistribution(
    projects: ProjectSummaryDto[],
    labelSelector: (project: ProjectSummaryDto) => string,
  ): DistributionRow[] {
    if (!Array.isArray(projects)) {
      return [];
    }

    const counts = projects.reduce<Record<string, number>>((accumulator, project) => {
      if (!project) return accumulator;
      const label = labelSelector(project) || 'Unassigned';
      accumulator[label] = (accumulator[label] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  private label(label: unknown, fallback: unknown): string {
    const value = label ?? fallback;
    return value === undefined || value === null || value === '' ? 'Unassigned' : String(value);
  }
}

