import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { finalize, timeout } from 'rxjs/operators';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

import {
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectStatus,
  ProjectSummaryDto,
  SelectOption,
  PaginatedResponse,
  ProjectFilterParams,
} from '../../models';
import { ProjectService } from '../../services/project';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-project-list',
  standalone: false,
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList implements OnInit, AfterViewInit {
  private readonly statusLabels: Record<ProjectStatus, string> = {
    [ProjectStatus.Planned]: 'Planned',
    [ProjectStatus.Ongoing]: 'Ongoing',
    [ProjectStatus.OnHold]: 'On Hold',
    [ProjectStatus.Done]: 'Done',
  };

  private readonly phaseLabels: Record<ProjectPhase, string> = {
    [ProjectPhase.Pipeline]: 'Pipeline',
    [ProjectPhase.PreProcess]: 'Pre-Process',
    [ProjectPhase.Initiation]: 'Initiation',
    [ProjectPhase.Planification]: 'Planification',
    [ProjectPhase.Execution]: 'Execution',
    [ProjectPhase.Monitoring]: 'Monitoring',
    [ProjectPhase.Closing]: 'Closing',
  };

  private readonly projectTypeLabels: Record<ProjectType, string> = {
    [ProjectType.NewProject]: 'New Project',
    [ProjectType.NewPhase]: 'New Phase',
    [ProjectType.Extension]: 'Extension',
    [ProjectType.Sustain]: 'Sustain',
    [ProjectType.NewProcessProject]: 'New Process Project',
  };

  private readonly managementTypeLabels: Record<ProjectManagementType, string> = {
    [ProjectManagementType.DigitalOperation]: 'Digital Operation',
    [ProjectManagementType.DigitalSolution]: 'Digital Solution',
    [ProjectManagementType.Infrastructure]: 'Infrastructure',
    [ProjectManagementType.ProcessSimplification]: 'Process Simplification',
    [ProjectManagementType.Other]: 'Other',
  } as Record<ProjectManagementType, string>;

  projects: ProjectSummaryDto[] = [];
  displayProjects: Array<{
    raw: ProjectSummaryDto;
    id: string;
    name: string;
    description: string;
    departmentName: string;
    managerDisplay: string;
    sponsorDisplay: string;
    managementTypeLabel: string;
    projectTypeLabel: string;
    phaseLabel: string;
    statusLabel: string;
    statusClass: string;
    budget: number;
    progress: number;
    estimatedHours: number;
    actualHours: number;
  }> = [];
  users: SelectOption[] = [];
  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPagesCount = 0;
  customPageSize: number | null = null;
  readonly availablePageSizes = [5, 10, 20, 100];
  isLoading = false;
  isRefreshing = false;
  deletingProjectId: string | null = null;
  errorMessage = '';
  private hasTriggeredInitialLoad = false;

  selectedStatus: string = 'all';
  selectedPhase: string = 'all';
  selectedManagementType: string = 'all';

  readonly statusOptions = [
    { id: 'all', label: 'All Statuses' },
    { id: '0', label: 'Ongoing', value: ProjectStatus.Ongoing },
    { id: '3', label: 'Planned', value: ProjectStatus.Planned },
    { id: '1', label: 'On Hold', value: ProjectStatus.OnHold },
    { id: '2', label: 'Done', value: ProjectStatus.Done },
  ];

  readonly phaseOptions = [
    { id: 'all', label: 'All Phases' },
    { id: '0', label: 'Pipeline', value: ProjectPhase.Pipeline },
    { id: '1', label: 'Pre-Process', value: ProjectPhase.PreProcess },
    { id: '2', label: 'Initiation', value: ProjectPhase.Initiation },
    { id: '3', label: 'Planification', value: ProjectPhase.Planification },
    { id: '4', label: 'Execution', value: ProjectPhase.Execution },
    { id: '5', label: 'Monitoring', value: ProjectPhase.Monitoring },
    { id: '6', label: 'Closing', value: ProjectPhase.Closing },
  ];

  readonly typeOptions = [
    { id: 'all', label: 'All Types' },
    { id: '1', label: 'New Project', value: ProjectType.NewProject },
    { id: '2', label: 'New Phase', value: ProjectType.NewPhase },
    { id: '3', label: 'Extension', value: ProjectType.Extension },
    { id: '4', label: 'Sustain', value: ProjectType.Sustain },
    { id: '5', label: 'New Process Project', value: ProjectType.NewProcessProject },
  ];

  readonly managementTypeOptions = [
    { id: 'all', label: 'All Categories' },
    { id: '0', label: 'Digital Operation', value: ProjectManagementType.DigitalOperation },
    { id: '1', label: 'Digital Solution', value: ProjectManagementType.DigitalSolution },
    { id: '2', label: 'Infrastructure', value: ProjectManagementType.Infrastructure },
    { id: '3', label: 'Process Simplification', value: ProjectManagementType.ProcessSimplification },
    { id: '4', label: 'Other', value: ProjectManagementType.Other },
  ];
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly projectService: ProjectService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly dialog: MatDialog,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  ngOnInit(): void {
    this.triggerInitialLoad();
  }

  ngAfterViewInit(): void {
    // Safety net for environments where init timing can skip the first trigger.
    this.triggerInitialLoad();
  }

  get filteredProjects() {
    return this.displayProjects;
  }

  get totalPages(): number {
    return this.totalPagesCount;
  }

  get paginatedProjects() {
    return this.displayProjects;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPagesCount) {
      this.currentPage = page;
      this.loadProjects();
    }
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.customPageSize = null;
    this.currentPage = 1;
    this.loadProjects();
  }

  onCustomPageSizeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value > 0) {
      this.pageSize = value;
      this.customPageSize = value;
      this.currentPage = 1;
      this.loadProjects();
    }
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
    this.loadProjects();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadProjects();
  }

  get pageStart(): number {
    if (!this.filteredProjects.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredProjects.length);
  }

  get hasProjects(): boolean {
    return this.projects.length > 0;
  }

  get hasFilteredProjects(): boolean {
    return this.filteredProjects.length > 0;
  }

  trackByProjectId(
    _: number,
    project: {
      id: string;
    }
  ): string {
    return project.id;
  }

  refreshProjects(): void {
    this.loadProjects(true);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadProjects();
  }

  private searchDebounceTimer: any;

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.loadProjects();
    }, 400);
  }



  getStatusCount(status: ProjectStatus): number {
    return this.projects.filter(p => p.status === status).length;
  }

  getVisiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  openDetails(projectId: string): void {
    void this.router.navigate([this.projectsBasePath(), projectId]);
  }

  openEdit(projectId: string): void {
    if (!this.isAdmin) {
      return;
    }
    void this.router.navigate([this.projectsBasePath(), projectId, 'edit']);
  }

  deleteProject(project: ProjectSummaryDto): void {
    if (!this.isAdmin || !project?.id || this.deletingProjectId) {
      return;
    }

    const data: ConfirmationDialogData = {
      title: 'Delete Project',
      message: `Are you sure you want to delete "${project.name}"? This action will permanently remove all associated tasks, hours, and documentation.`,
      icon: 'folder_delete',
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
        this.executeDelete(project);
      }
    });
  }

  private executeDelete(project: ProjectSummaryDto): void {
    this.deletingProjectId = project.id;

    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        this.projects = this.projects.filter((item) => item.id !== project.id);
        this.deletingProjectId = null;
        this.notificationService.showSuccess('Project deleted successfully.');
      },
      error: (error) => {
        this.deletingProjectId = null;
        this.notificationService.showError(this.extractErrorMessage(error, 'Unable to delete project.'));
      },
    });
  }

  private getFilters(): Record<string, string | number | boolean | null | undefined> {
    return {
      Search: this.searchTerm.trim() || null,
      Status: this.selectedStatus !== 'all' ? Number(this.selectedStatus) : null,
      Phase: this.selectedPhase !== 'all' ? Number(this.selectedPhase) : null,
      ProjectManagementType: this.selectedManagementType !== 'all' ? Number(this.selectedManagementType) : null,
    };
  }

  onExport(): void {
    if (!this.hasFilteredProjects) {
      this.notificationService.showError('No projects to export.');
      return;
    }

    this.notificationService.showInfo('Preparing Excel report... please wait.');
    this.isRefreshing = true;

    // We fetch all filtered projects (up to 2000) to ensure the export is complete
    const params: ProjectFilterParams = {
      PageNumber: 1,
      PageSize: 2000,
      Search: this.searchTerm.trim() || undefined,
      Status: this.selectedStatus !== 'all' ? Number(this.selectedStatus) : undefined,
      Phase: this.selectedPhase !== 'all' ? Number(this.selectedPhase) : undefined,
      ProjectManagementType: this.selectedManagementType !== 'all' ? Number(this.selectedManagementType) : undefined,
    };

    this.projectService.getProjectsPaged(params).subscribe({
      next: (response) => {
        this.isRefreshing = false;
        const dataToExport = response.data.map(p => ({
          'Project Name': p.name,
          'Department': p.departmentName || 'N/A',
          'Type': this.getManagementTypeLabel(p),
          'Phase': this.getPhaseLabel(p),
          'Status': this.getStatusLabel(p),
          'Sponsor': this.getSponsorDisplay(p),
          'Estimated Hours': this.getEstimatedHoursDisplay(p),
          'Actual Hours': p.actualHours || 0,
          'Description': p.description || 'No description provided yet.',
          'Start Date': p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A',
          'Estimated Due Date': p.estimatedDueDate ? new Date(p.estimatedDueDate).toLocaleDateString() : 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

        // Adjust column widths for better readability
        const wscols = [
          { wch: 30 }, // Name
          { wch: 40 }, // Description
          { wch: 20 }, // Department
          { wch: 25 }, // Manager
          { wch: 25 }, // Sponsor
          { wch: 20 }, // Category
          { wch: 15 }, // Type
          { wch: 15 }, // Phase
          { wch: 15 }, // Status
          { wch: 12 }, // Budget
          { wch: 12 }, // Progress
          { wch: 15 }, // Est Hours
          { wch: 15 }, // Act Hours
          { wch: 12 }, // Start
          { wch: 12 }  // End
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `PMHUB_Projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
        this.notificationService.showSuccess('Export generated successfully with full labels.');
      },
      error: (error) => {
        this.isRefreshing = false;
        this.notificationService.showError('Unable to fetch projects for export.');
      }
    });
  }

  exportToCsv(): void {
    this.onExport();
  }

  private getStatusLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);
    const label = project.statusLabel || this.readString(raw, ['statusLabel', 'StatusLabel']);
    if (label) return label;

    const value = project.status ?? this.readNumber(raw, ['status', 'Status']);
    if (value === undefined || value === null) return 'N/A';

    return this.statusLabels[value as ProjectStatus] || String(value);
  }

  private getPhaseLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);
    const label = project.phaseLabel || this.readString(raw, ['phaseLabel', 'PhaseLabel']);
    if (label) return label;

    const value = project.phase ?? this.readNumber(raw, ['phase', 'Phase']);
    if (value === undefined || value === null) return 'N/A';

    return this.phaseLabels[value as ProjectPhase] || String(value);
  }

  private getProjectTypeLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);

    // 1. Try numeric value from projectType (Priority)
    const value = project.projectType ?? this.readNumber(raw, ['projectType', 'ProjectType']);
    if (value !== undefined && value !== null && this.projectTypeLabels[value as ProjectType]) {
      return this.projectTypeLabels[value as ProjectType];
    }

    // 2. Fallback to explicit label from backend
    const label = project.projectTypeLabel || this.readString(raw, ['projectTypeLabel', 'ProjectTypeLabel']);
    if (label) return label;

    return value !== undefined && value !== null ? String(value) : 'N/A';
  }

  private getManagementTypeLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);

    // 1. Try numeric value from projectManagementType (Priority)
    const value = project.projectManagementType ?? this.readNumber(raw, ['projectManagementType', 'ProjectManagementType']);
    if (value !== undefined && value !== null && this.managementTypeLabels[value as ProjectManagementType]) {
      return this.managementTypeLabels[value as ProjectManagementType];
    }

    // 2. Fallback to explicit label from backend (if not "Development")
    const label = project.projectManagementTypeLabel || this.readString(raw, ['projectManagementTypeLabel', 'ProjectManagementTypeLabel']);
    if (label && label.toLowerCase() !== 'development') return label;

    return value !== undefined && value !== null ? `Category ${value}` : 'N/A';
  }

  private getStatusClass(project: ProjectSummaryDto): string {
    switch (project.status) {
      case ProjectStatus.Planned:
        return 'badge--planned';
      case ProjectStatus.Ongoing:
        return 'badge--ongoing';
      case ProjectStatus.OnHold:
        return 'badge--hold';
      case ProjectStatus.Done:
        return 'badge--done';
      default:
        return '';
    }
  }

  private getProjectManagerDisplay(project: ProjectSummaryDto): string {
    if (project.projectManagerName?.trim()) {
      return project.projectManagerName;
    }

    if (!project.projectManagerId) {
      return 'Not assigned';
    }

    const matchedUser = this.users.find((user) => user.id === project.projectManagerId);
    return matchedUser?.label || 'Assigned';
  }

  private getSponsorDisplay(project: ProjectSummaryDto): string {
    if (project.sponsor?.trim()) {
      return project.sponsor;
    }

    const rawProject = this.asRecord(project);
    return this.readString(rawProject, ['sponsorName', 'sponsorUserName', 'sponsorFullName']) || 'N/A';
  }

  private getEstimatedHoursDisplay(project: ProjectSummaryDto): number {
    if (project.estimatedHours !== null && project.estimatedHours !== undefined) {
      return Number(project.estimatedHours);
    }

    const rawProject = this.asRecord(project);
    const fallback = this.readNumber(rawProject, ['estimatedHours', 'totalEstimatedHours', 'plannedHours']);
    return fallback ?? 0;
  }

  private getProgressDisplay(project: ProjectSummaryDto): number {
    if (project.progressPercentage !== null && project.progressPercentage !== undefined) {
      return Number(project.progressPercentage);
    }

    const rawProject = this.asRecord(project);
    const fallback = this.readNumber(rawProject, ['progressPercentage', 'progress', 'completionPercentage']);
    return fallback ?? 0;
  }

  private projectsBasePath(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.includes('/admin/projects') ? '/admin/projects' : '/projects';
  }

  private userIsInvolvedInProject(project: ProjectSummaryDto): boolean {
    const uid = this.authService.getCurrentUser()?.userId;
    if (!uid) {
      return false;
    }
    if (project.projectManagerId && project.projectManagerId === uid) {
      return true;
    }
    // Summary DTO might not include members list for efficiency.
    // If we reach here, we rely on backend-level filtering for non-admin users.
    return false;
  }

  private loadProjects(isManualRefresh = false): void {
    this.errorMessage = '';

    if (isManualRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }

    const params: ProjectFilterParams = {
      PageNumber: this.currentPage,
      PageSize: this.pageSize,
      Search: this.searchTerm.trim() || undefined,
      Status: this.selectedStatus !== 'all' ? Number(this.selectedStatus) : undefined,
      Phase: this.selectedPhase !== 'all' ? Number(this.selectedPhase) : undefined,
      ProjectManagementType: this.selectedManagementType !== 'all' ? Number(this.selectedManagementType) : undefined,
    };

    this.projectService
      .getProjectsPaged(params)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.projects = response.data;
          this.totalCount = response.totalCount;
          this.totalPagesCount = response.totalPages;
          this.currentPage = response.pageNumber;

          this.rebuildDisplayProjects();
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'Unable to load projects right now.');
          this.displayProjects = [];
          this.cdr.detectChanges();
        },
      });
  }

  private triggerInitialLoad(): void {
    if (this.hasTriggeredInitialLoad) {
      return;
    }
    this.hasTriggeredInitialLoad = true;
    this.loadProjects();
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      error?: { errors?: string[]; message?: string };
      message?: string;
      status?: number;
    };

    if (apiError?.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (apiError?.status === 403) {
      return 'You do not have permission to access the projects workspace.';
    }

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

  private rebuildDisplayProjects(): void {
    this.displayProjects = this.projects.map((project) => ({
      raw: project,
      id: project.id,
      name: project.name,
      description: project.description || 'No description provided yet.',
      departmentName: project.departmentName || 'N/A',
      managerDisplay: this.getProjectManagerDisplay(project),
      sponsorDisplay: this.getSponsorDisplay(project),
      managementTypeLabel: this.getManagementTypeLabel(project),
      projectTypeLabel: this.getProjectTypeLabel(project),
      phaseLabel: this.getPhaseLabel(project),
      statusLabel: this.getStatusLabel(project),
      statusClass: this.getStatusClass(project),
      budget: Number(project.budget ?? 0),
      progress: this.getProgressDisplay(project),
      estimatedHours: this.getEstimatedHoursDisplay(project),
      actualHours: Number(project.actualHours ?? 0),
    }));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private readNumber(record: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }

    return null;
  }
}
