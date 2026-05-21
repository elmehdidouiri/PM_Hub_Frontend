import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { ProjectDto } from '../../models';
import {
  HoursAllocationByProjectUserDto,
  HoursAllocationDashboardParams,
} from '../../../dashboard/models/hours-allocation-dashboard.models';
import { HoursAllocationDashboardService } from '../../../dashboard/services/hours-allocation-dashboard.service';

@Component({
  selector: 'app-project-allocations-page',
  standalone: false,
  templateUrl: './project-allocations-page.html',
  styleUrl: './project-allocations-page.scss',
})
export class ProjectAllocationsPage implements OnInit {
  project: ProjectDto | null = null;
  isLoading = false;
  errorMessage = '';
  search = '';
  allocations: HoursAllocationByProjectUserDto[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly hoursAllocationDashboard: HoursAllocationDashboardService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.project = this.route.snapshot.data['project'] as ProjectDto | null;
    this.loadAllocations();
  }

  backToProject(): void {
    this.router.navigate(['/projects', this.project?.id || this.route.snapshot.paramMap.get('id')]);
  }

  reload(): void {
    this.loadAllocations();
  }

  clearSearch(): void {
    if (!this.search.trim()) {
      return;
    }

    this.search = '';
    this.loadAllocations();
  }

  get totalHours(): number {
    return this.allocations.reduce((total, item) => total + item.totalHours, 0);
  }

  get workedDays(): number {
    return this.allocations.reduce((total, item) => total + item.workedDays, 0);
  }

  get allocationCount(): number {
    return this.allocations.reduce((total, item) => total + item.allocationCount, 0);
  }

  get averageHours(): number {
    return this.allocations.length ? this.totalHours / this.allocations.length : 0;
  }

  get sortedAllocations(): HoursAllocationByProjectUserDto[] {
    return [...this.allocations].sort((a, b) => b.totalHours - a.totalHours);
  }

  get activityBreakdown(): Array<{ label: string; value: number; icon: string }> {
    const totals = this.allocations.reduce(
      (acc, item) => {
        acc.execution += item.executionHours;
        acc.techLead += item.techLeadHours;
        acc.process += item.processHours;
        acc.projectManagement += item.projectManagementHours;
        acc.researchAndDev += item.researchAndDevHours;
        acc.workshop += item.workshopHours;
        acc.other += item.otherHours;
        return acc;
      },
      { execution: 0, techLead: 0, process: 0, projectManagement: 0, researchAndDev: 0, workshop: 0, other: 0 }
    );

    return [
      { label: 'Execution', value: totals.execution, icon: 'rocket_launch' },
      { label: 'Tech lead', value: totals.techLead, icon: 'engineering' },
      { label: 'Process', value: totals.process, icon: 'account_tree' },
      { label: 'Project management', value: totals.projectManagement, icon: 'assignment_turned_in' },
      { label: 'R&D', value: totals.researchAndDev, icon: 'science' },
      { label: 'Workshop', value: totals.workshop, icon: 'groups' },
      { label: 'Other', value: totals.other, icon: 'more_horiz' },
    ].filter((item) => item.value > 0);
  }

  getInitials(value: string | null | undefined): string {
    return (value || 'User')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  getDominantActivity(item: HoursAllocationByProjectUserDto): string {
    const categories = [
      { label: 'Execution', value: item.executionHours },
      { label: 'Tech lead', value: item.techLeadHours },
      { label: 'Process', value: item.processHours },
      { label: 'PM', value: item.projectManagementHours },
      { label: 'R&D', value: item.researchAndDevHours },
      { label: 'Workshop', value: item.workshopHours },
      { label: 'Other', value: item.otherHours },
    ];
    const best = categories.sort((a, b) => b.value - a.value)[0];
    return best?.value > 0 ? best.label : '-';
  }

  allocationShare(item: HoursAllocationByProjectUserDto): number {
    const max = Math.max(1, ...this.allocations.map((row) => row.totalHours));
    return Math.max(0, Math.min(100, (item.totalHours / max) * 100));
  }

  activityShare(value: number): number {
    const total = this.activityBreakdown.reduce((sum, item) => sum + item.value, 0);
    return total ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  }

  private loadAllocations(): void {
    const projectId = this.project?.id || this.route.snapshot.paramMap.get('id');
    if (!projectId) {
      return;
    }

    const params: HoursAllocationDashboardParams = {
      analysis: 'projectUsers',
      projectId,
      search: this.search.trim() || null,
      all: true,
    };

    this.isLoading = true;
    this.errorMessage = '';

    this.hoursAllocationDashboard
      .getDashboard(params)
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load project allocations.';
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((dashboard) => {
        this.allocations = dashboard?.hoursByProjectUser ?? [];
      });
  }
}
