import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, finalize, of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth';
import { HourEntriesApiService } from '../../../../core/services/hour-entries-api.service';
import { HourEntryDto } from '../../../../core/models/hour-entry.model';
import { ProjectDto } from '../../models';
import {
  HoursAllocationByProjectUserDto,
  HoursAllocationDashboardDto,
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
    private readonly hourEntriesApi: HourEntriesApiService,
    private readonly authService: AuthService,
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

    const params: Omit<HoursAllocationDashboardParams, 'projectId'> = {
      analysis: 'projectUsers',
      search: this.search.trim() || null,
      all: true,
    };

    this.isLoading = true;
    this.errorMessage = '';

    const request$: Observable<HoursAllocationDashboardDto | HourEntryDto[] | null> = this.authService.isAdmin()
      ? this.hoursAllocationDashboard
          .getProjectDashboard(projectId, params)
          .pipe(
            catchError(() => {
              this.errorMessage = 'Unable to load project allocations.';
              return of(null);
            })
          )
      : this.hourEntriesApi
          .getMyByProject(projectId)
          .pipe(
            catchError(() => {
              this.errorMessage = 'Unable to load your project allocations.';
              return of(null);
            })
          );

    request$
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((result) => {
        this.allocations = Array.isArray(result)
          ? this.toMyProjectAllocationRows(result, projectId)
          : result?.hoursByProjectUser ?? [];
      });
  }

  private toMyProjectAllocationRows(entries: HourEntryDto[], projectId: string): HoursAllocationByProjectUserDto[] {
    const query = this.search.trim().toLowerCase();
    const currentUser = this.authService.getCurrentUser();
    const userName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim()
      || entries.find((entry) => entry.userFullName)?.userFullName
      || currentUser?.email
      || 'Me';
    const projectName = this.project?.name || entries.find((entry) => entry.projectName)?.projectName || '';

    if (query && !`${userName} ${projectName}`.toLowerCase().includes(query)) {
      return [];
    }

    return [{
      projectId,
      projectName,
      userId: currentUser?.userId || entries.find((entry) => entry.userId)?.userId || '',
      userName,
      role: currentUser?.roleName || '',
      totalHours: this.sumEntries(entries, 'totalHours'),
      executionHours: this.sumEntries(entries, 'executionHours'),
      techLeadHours: this.sumEntries(entries, 'supervisionHours'),
      processHours: this.sumEntries(entries, 'processHours'),
      projectManagementHours: this.sumEntries(entries, 'managementHours'),
      researchAndDevHours: this.sumEntries(entries, 'rAndDHours'),
      workshopHours: this.sumEntries(entries, 'workshopHours'),
      otherHours: this.sumEntries(entries, 'otherHours') + this.sumEntries(entries, 'internManagementHours'),
      workedDays: new Set(entries.map((entry) => entry.date).filter(Boolean)).size,
      allocationCount: entries.length,
      isProjectManager: false,
    }];
  }

  private sumEntries(entries: HourEntryDto[], key: keyof HourEntryDto): number {
    return entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
  }
}
