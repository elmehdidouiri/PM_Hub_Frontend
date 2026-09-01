import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { finalize, timeout } from 'rxjs/operators';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import { ProjectQuickPreviewDialog } from './project-quick-preview-dialog';

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
import { StorageService } from '../../../../core/services/storage.service';
import { environment } from '../../../../../environments/environment';
import * as XLSX from 'xlsx';

interface ProjectListViewState {
  searchTerm: string;
  currentPage: number;
  pageSize: number;
  selectedStatus: string;
  selectedPhase: string;
  selectedManagementType: string;
  selectedIncompleteOnly: boolean;
  selectedDelayedOnly: boolean;
  selectedDepartmentId: string;
  selectedBusinessUnitId: string;
  selectedPlantId: string;
  selectedProcessStatus: string;
  startDate: string | null;
  endDate: string | null;
  year: number | null;
  month: number | null;
  selectedYtd: boolean;
  selectedProjectScope: 'mine' | 'all' | null;
}

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
    isDataComplete?: boolean;
    dataCompletionPercentage?: number;
    missingFields?: string[];
  }> = [];
  users: SelectOption[] = [];
  searchTerm = '';
  currentPage = 1;
  pageSize = 5;
  totalCount = 0;
  totalPagesCount = 0;
  customPageSize: number | null = null;
  readonly availablePageSizes = [5, 10, 20, 50, 100, 10000];
  showExportModal = false;
  exportTypeOption: 'standard' | 'mtd' | 'ytd' | 'fy' = 'standard';
  selectedFiscalYear = 2026;
  readonly fiscalYearOptions = [2027, 2026, 2025, 2024, 2023];
  isLoading = false;
  isRefreshing = false;
  deletingProjectId: string | null = null;
  errorMessage = '';
  selectedProjectIds = new Set<string>();
  private hasTriggeredInitialLoad = false;
  private loadSubscription?: Subscription;
  private readonly storageKeyPrefix = 'pmhub.project-list.view-state';

  selectedStatus: string = 'all';
  selectedPhase: string = 'all';
  selectedManagementType: string = 'all';
  selectedIncompleteOnly: boolean = false;
  selectedDelayedOnly: boolean = false;

  selectedDepartmentId: string = 'all';
  selectedBusinessUnitId: string = 'all';
  selectedPlantId: string = 'all';
  selectedProcessStatus: string = 'all';
  startDate: string | null = null;
  endDate: string | null = null;
  year: number | null = null;
  month: number | null = null;
  selectedYtd = false;
  showDashboardBackButton = false;
  selectedProjectScope: 'mine' | 'all' | null = null;
  dashboardReturnView: 'admin' | 'mine' | 'all' | 'personal' | null = null;

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

  get effectiveProjectScope(): 'mine' | 'all' {
    return this.selectedProjectScope ?? 'all';
  }

  get pageTitle(): string {
    if (this.effectiveProjectScope === 'mine') {
      return 'My projects';
    }

    return this.isAdmin ? 'Projects directory' : 'All projects';
  }

  get pageDescription(): string {
    if (this.effectiveProjectScope === 'mine') {
      return this.showDashboardBackButton
        ? 'Projects matching the dashboard filters within your own project scope.'
        : 'Projects assigned to you as a member or project manager.';
    }

    if (this.showDashboardBackButton) {
      return 'All projects matching the dashboard filters.';
    }

    if (this.isAdmin) {
      return 'Explore the project portfolio, track execution phases and manage delivery scope.';
    }

    return 'Projects you are assigned to as a member or project manager. Open a project to see details.';
  }
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly projectService: ProjectService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly storage: StorageService,
    private readonly dialog: MatDialog,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute
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

  get selectedProjectCount(): number {
    return this.selectedProjectIds.size;
  }

  get areAllPageProjectsSelected(): boolean {
    const visibleIds = this.getVisibleProjectIds();
    return visibleIds.length > 0 && visibleIds.every((id) => this.selectedProjectIds.has(id));
  }

  get isPageSelectionIndeterminate(): boolean {
    const visibleIds = this.getVisibleProjectIds();
    const selectedVisibleCount = visibleIds.filter((id) => this.selectedProjectIds.has(id)).length;
    return selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPagesCount) {
      this.currentPage = page;
      this.persistViewState();
      this.loadProjects();
    }
  }

  onPageSizeChange(newSize: number | string): void {
    const parsedSize = Number(newSize);
    this.pageSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 5;
    this.currentPage = 1;
    this.persistViewState();
    this.loadProjects();
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
    this.persistViewState();
    this.loadProjects();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.persistViewState();
    this.loadProjects();
  }

  get pageStart(): number {
    if (!this.filteredProjects.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    if (!this.filteredProjects.length) {
      return 0;
    }

    return Math.min(this.pageStart + this.filteredProjects.length - 1, this.totalCount);
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

  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.has(projectId);
  }

  toggleProjectSelection(projectId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.selectedProjectIds.add(projectId);
    } else {
      this.selectedProjectIds.delete(projectId);
    }
  }

  toggleSelectAllVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const visibleIds = this.getVisibleProjectIds();

    if (checked) {
      visibleIds.forEach((id) => this.selectedProjectIds.add(id));
      return;
    }

    visibleIds.forEach((id) => this.selectedProjectIds.delete(id));
  }

  clearSelection(): void {
    this.selectedProjectIds.clear();
  }

  refreshProjects(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = undefined;
    }
    this.errorMessage = '';
    this.loadProjects(true);
  }

  backToDashboard(): void {
    void this.router.navigate(['/dashboard'], {
      queryParams: this.buildDashboardReturnParams(),
    });
  }

  setProjectScope(scope: 'mine' | 'all'): void {
    if (this.effectiveProjectScope === scope || this.isLoading || this.isRefreshing) {
      return;
    }

    this.selectedProjectScope = scope;
    this.currentPage = 1;
    this.persistViewState();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        projectScope: scope,
        all: scope === 'all',
      },
      queryParamsHandling: 'merge',
    });
  }

  navigateToCreateProject(): void {
    void this.router.navigate([this.projectsBasePath(), 'new']);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.persistViewState();
    this.loadProjects();
  }

  get hasActiveDashboardFilters(): boolean {
    return this.selectedProjectScope !== null ||
           this.selectedBusinessUnitId !== 'all' ||
           this.selectedDepartmentId !== 'all' ||
           this.selectedPlantId !== 'all' ||
           this.selectedStatus !== 'all' ||
           this.selectedPhase !== 'all' ||
           this.selectedManagementType !== 'all' ||
           this.selectedProcessStatus !== 'all' ||
           this.selectedDelayedOnly ||
           this.startDate !== null ||
           this.endDate !== null ||
           this.year !== null ||
           this.month !== null ||
           this.selectedYtd;
  }

  clearDashboardFilters(): void {
    this.selectedBusinessUnitId = 'all';
    this.selectedDepartmentId = 'all';
    this.selectedPlantId = 'all';
    this.selectedStatus = 'all';
    this.selectedPhase = 'all';
    this.selectedManagementType = 'all';
    this.selectedProcessStatus = 'all';
    this.selectedDelayedOnly = false;
    this.startDate = null;
    this.endDate = null;
    this.year = null;
    this.month = null;
    this.selectedYtd = false;
    this.selectedProjectScope = null;
    this.persistViewState();
    
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        BusinessUnitId: null,
        DepartmentId: null,
        PlantId: null,
        Status: null,
        status: null,
        Phase: null,
        phase: null,
        ProjectManagementType: null,
        projectManagementType: null,
        ProcessStatus: null,
        processStatus: null,
        DelayedOnly: null,
        delayedOnly: null,
        startDate: null,
        endDate: null,
        year: null,
        month: null,
        ytd: null,
        projectScope: null,
        ProjectScope: null,
        dashboardView: null,
        DashboardView: null,
        all: null,
        All: null,
        source: null
      },
      queryParamsHandling: 'merge'
    });
    
    this.currentPage = 1;
    this.loadProjects();
  }

  private searchDebounceTimer: any;

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.persistViewState();

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
    this.persistViewState();
    void this.router.navigate([this.projectsBasePath(), projectId]);
  }

  openQuickPreview(projectId: string): void {
    const dialogRef = this.dialog.open(ProjectQuickPreviewDialog, {
      data: { projectId },
      maxWidth: '92vw',
      maxHeight: '92vh',
      panelClass: 'pm-project-preview-dialog',
    });

    dialogRef.afterClosed().subscribe((action) => {
      if (action === 'open-details') {
        this.openDetails(projectId);
      }
    });
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
        this.selectedProjectIds.delete(project.id);
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
      IncompleteOnly: this.selectedIncompleteOnly ? true : null,
    };
  }

  openExportModal(): void {
    this.showExportModal = true;
    this.exportTypeOption = 'standard';
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  confirmAndExport(): void {
    const isFy = this.exportTypeOption === 'fy';
    this.onExport(this.exportTypeOption, isFy ? this.selectedFiscalYear : undefined);
    this.closeExportModal();
  }

  onExport(exportType: string = 'standard', fiscalYear?: number): void {
    const typeLabel = exportType === 'fy' ? `FY ${fiscalYear}` : exportType;
    this.notificationService.showSuccess(`Starting ${typeLabel} export, please wait...`);
    const filters = this.getFilters();
    
    if (exportType !== 'standard') {
      filters['exportType'] = exportType;
    }
    
    if (fiscalYear) {
      filters['year'] = fiscalYear;
    }

    this.projectService.exportProjects(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filenameSuffix = exportType === 'standard' ? '' : (exportType === 'fy' ? `_FY${fiscalYear}` : `_${exportType.toUpperCase()}`);
        a.download = `PMHUB_Projects_Export${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notificationService.showSuccess('Export downloaded successfully.');
      },
      error: (error) => {
        this.notificationService.showError('Unable to export projects.');
      }
    });
  }

  exportToCsv(): void {
    this.onExport('standard');
  }

  exportSelectedProjects(): void {
    const selectedProjects = this.projects.filter((project) => this.selectedProjectIds.has(project.id));

    if (!selectedProjects.length) {
      this.notificationService.showError('Please select at least one project to export.');
      return;
    }

    const bookingHoursHeader = this.getSelectedExportBookingHoursHeader();
    const rows = selectedProjects.map((project) => this.toSelectedExportRow(project, bookingHoursHeader));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    worksheet['!cols'] = [
      { wch: 32 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 28 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Projects');
    XLSX.writeFile(
      workbook,
      `PMHUB_Selected_Projects_${selectedProjects.length}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    this.notificationService.showSuccess(`${selectedProjects.length} selected project(s) exported successfully.`);
  }

  private toSelectedExportRow(
    project: ProjectSummaryDto,
    bookingHoursHeader: string
  ): Record<string, string | number> {
    const raw = this.asRecord(project);

    return {
      Name: project.name,
      Status: this.getStatusLabel(project),
      Phase: this.getPhaseLabel(project),
      Type: this.getManagementTypeLabel(project),
      'Start Date': this.formatExportDate(project.startDate),
      'End Date': this.formatExportDate(project.endDate ?? project.estimatedDueDate),
      Department: project.departmentName || '-',
      Plant: project.plantName || this.readString(raw, ['plantName', 'PlantName', 'plant', 'Plant']) || '-',
      Sponsor: this.getSponsorDisplay(project),
      'Cost Center': this.readString(raw, ['costCenter', 'CostCenter']) || '-',
      'Est. Hours': this.getEstimatedHoursDisplay(project),
      'Act. Hours': Number(project.actualHours ?? this.readNumber(raw, ['actualHours', 'ActualHours']) ?? 0),
      [bookingHoursHeader]: this.getSelectedExportBookingHours(project),
    };
  }

  private getSelectedExportBookingHoursHeader(): string {
    const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(
      new Date(this.year ?? new Date().getFullYear(), (this.month ?? new Date().getMonth() + 1) - 1, 1)
    );

    return `Total Booking Hours (${monthName})`;
  }

  private getSelectedExportBookingHours(project: ProjectSummaryDto): string | number {
    const raw = this.asRecord(project);
    const monthName = new Intl.DateTimeFormat('en', { month: 'long' })
      .format(new Date(this.year ?? new Date().getFullYear(), (this.month ?? new Date().getMonth() + 1) - 1, 1));
    const compactMonth = monthName.replace(/\s+/g, '');
    const monthKey = compactMonth.charAt(0).toLowerCase() + compactMonth.slice(1);

    return this.readNumber(raw, [
      `totalBookingHours${compactMonth}`,
      `TotalBookingHours${compactMonth}`,
      `${monthKey}BookingHours`,
      `${monthKey}TotalBookingHours`,
      'totalBookingHoursForMonth',
      'TotalBookingHoursForMonth',
      'monthlyBookingHours',
      'MonthlyBookingHours',
      'bookingHours',
      'BookingHours',
    ]) ?? '';
  }

  private formatExportDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toISOString().slice(0, 10);
  }

  private getStatusLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);
    const label = project.statusLabel || this.readString(raw, ['statusLabel', 'StatusLabel']);
    if (label) return label;

    const value = project.status ?? this.readNumber(raw, ['status', 'Status']);
    if (value === undefined || value === null) return '-';

    return this.statusLabels[value as ProjectStatus] || String(value);
  }

  private toExportRow(project: ProjectSummaryDto): Record<string, string | number> {
    return {
      'Project Name': project.name,
      Department: project.departmentName || '-',
      Type: this.getManagementTypeLabel(project),
      Phase: this.getPhaseLabel(project),
      Status: this.getStatusLabel(project),
      Sponsor: this.getSponsorDisplay(project),
      'Estimated Hours': this.getEstimatedHoursDisplay(project),
      'Actual Hours': project.actualHours || 0,
      Description: project.description || 'No description provided yet.',
      'Start Date': project.startDate ? new Date(project.startDate).toLocaleDateString() : '-',
      'Estimated Due Date': project.estimatedDueDate ? new Date(project.estimatedDueDate).toLocaleDateString() : '-',
    };
  }

  private getPhaseLabel(project: ProjectSummaryDto): string {
    const raw = this.asRecord(project);
    const label = project.phaseLabel || this.readString(raw, ['phaseLabel', 'PhaseLabel']);
    if (label) return label;

    const value = project.phase ?? this.readNumber(raw, ['phase', 'Phase']);
    if (value === undefined || value === null) return '-';

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

    return value !== undefined && value !== null ? String(value) : '-';
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

    return value !== undefined && value !== null ? `Category ${value}` : '-';
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
    return this.readString(rawProject, ['sponsorName', 'sponsorUserName', 'sponsorFullName']) || '-';
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
      IncompleteOnly: this.selectedIncompleteOnly ? true : undefined,
      DelayedOnly: this.selectedDelayedOnly ? true : undefined,
      DepartmentId: this.selectedDepartmentId !== 'all' ? this.selectedDepartmentId : undefined,
      BusinessUnitId: this.selectedBusinessUnitId !== 'all' ? this.selectedBusinessUnitId : undefined,
      PlantId: this.selectedPlantId !== 'all' ? this.selectedPlantId : undefined,
      ProcessStatus: this.selectedProcessStatus !== 'all' ? this.selectedProcessStatus : undefined,
      ytd: this.selectedYtd ? true : undefined,
    };

    const projectScope = this.getEffectiveProjectScope();
    if (projectScope) {
      params.All = projectScope === 'all';
    }

    if (this.startDate) (params as any).startDate = this.startDate;
    if (this.endDate) (params as any).endDate = this.endDate;
    if (this.year) (params as any).year = this.year;
    if (this.month) (params as any).month = this.month;

    this.loadSubscription?.unsubscribe();

    this.loadSubscription = this.projectService
      .getProjectsPaged(params, { noCache: isManualRefresh })
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
          const requestedPageSize = Number(this.pageSize) || 5;
          const responseProjects = response.data ?? [];

          this.projects = responseProjects.length > requestedPageSize
            ? responseProjects.slice(0, requestedPageSize)
            : responseProjects;
          this.totalCount = Number(response.totalCount ?? this.projects.length);
          this.totalPagesCount = Number(response.totalPages) || Math.ceil(this.totalCount / requestedPageSize);
          this.currentPage = Number(response.pageNumber) || this.currentPage;

          this.rebuildDisplayProjects();
          this.pruneSelection();
          this.persistViewState();
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
    
    this.route.queryParams.subscribe((params) => {
      if (this.hasProjectListRouteState(params)) {
        this.applyRouteFilters(params);
        this.persistViewState();
      } else {
        this.restoreViewState();
      }
      this.loadProjects();
    });
  }

  private hasProjectListRouteState(params: Record<string, unknown>): boolean {
    const stateKeys = [
      'Search', 'search', 'Status', 'status', 'Phase', 'phase',
      'ProjectManagementType', 'projectManagementType', 'IncompleteOnly', 'incompleteOnly',
      'DelayedOnly', 'delayedOnly', 'BusinessUnitId', 'businessUnitId',
      'DepartmentId', 'departmentId', 'PlantId', 'plantId', 'ProcessStatus',
      'processStatus', 'startDate', 'endDate', 'year', 'month', 'ytd',
      'projectScope', 'ProjectScope', 'all', 'All', 'dashboardView', 'DashboardView', 'source'
    ];

    return stateKeys.some((key) => params[key] !== undefined && params[key] !== null);
  }

  private persistViewState(): void {
    if (!this.isBrowser) {
      return;
    }

    this.storage.setItem(this.getStorageKey(), {
      searchTerm: this.searchTerm,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      selectedStatus: this.selectedStatus,
      selectedPhase: this.selectedPhase,
      selectedManagementType: this.selectedManagementType,
      selectedIncompleteOnly: this.selectedIncompleteOnly,
      selectedDelayedOnly: this.selectedDelayedOnly,
      selectedDepartmentId: this.selectedDepartmentId,
      selectedBusinessUnitId: this.selectedBusinessUnitId,
      selectedPlantId: this.selectedPlantId,
      selectedProcessStatus: this.selectedProcessStatus,
      startDate: this.startDate,
      endDate: this.endDate,
      year: this.year,
      month: this.month,
      selectedYtd: this.selectedYtd,
      selectedProjectScope: this.selectedProjectScope,
    });
  }

  private restoreViewState(): void {
    const state = this.storage.getItem<ProjectListViewState>(this.getStorageKey());
    if (!state) {
      return;
    }

    this.searchTerm = typeof state.searchTerm === 'string' ? state.searchTerm : '';
    this.currentPage = this.toPositiveNumber(state.currentPage, 1);
    this.pageSize = this.toPositiveNumber(state.pageSize, 5);
    this.selectedStatus = state.selectedStatus || 'all';
    this.selectedPhase = state.selectedPhase || 'all';
    this.selectedManagementType = state.selectedManagementType || 'all';
    this.selectedIncompleteOnly = !!state.selectedIncompleteOnly;
    this.selectedDelayedOnly = !!state.selectedDelayedOnly;
    this.selectedDepartmentId = state.selectedDepartmentId || 'all';
    this.selectedBusinessUnitId = state.selectedBusinessUnitId || 'all';
    this.selectedPlantId = state.selectedPlantId || 'all';
    this.selectedProcessStatus = state.selectedProcessStatus || 'all';
    this.startDate = state.startDate || null;
    this.endDate = state.endDate || null;
    this.year = this.toOptionalNumber(state.year);
    this.month = this.toOptionalNumber(state.month);
    this.selectedYtd = !!state.selectedYtd;
    this.selectedProjectScope = state.selectedProjectScope === 'mine' || state.selectedProjectScope === 'all'
      ? state.selectedProjectScope
      : null;
  }

  private getStorageKey(): string {
    return `${this.storageKeyPrefix}.${this.authService.getCurrentUser()?.userId ?? 'anonymous'}`;
  }

  private toPositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toOptionalNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private applyRouteFilters(params: Record<string, unknown>): void {
    this.searchTerm = String(params['Search'] ?? params['search'] ?? '');
    this.selectedStatus = this.readRouteString(params, ['Status', 'status'], 'all');
    this.selectedPhase = this.readRouteString(params, ['Phase', 'phase'], 'all');
    this.selectedManagementType = this.readRouteString(params, ['ProjectManagementType', 'projectManagementType'], 'all');
    this.selectedIncompleteOnly = this.readRouteBoolean(params, ['incompleteOnly', 'IncompleteOnly']);
    this.selectedDelayedOnly = this.readRouteBoolean(params, ['delayedOnly', 'DelayedOnly']);
    this.selectedBusinessUnitId = this.readRouteString(params, ['BusinessUnitId', 'businessUnitId'], 'all');
    this.selectedDepartmentId = this.readRouteString(params, ['DepartmentId', 'departmentId'], 'all');
    this.selectedPlantId = this.readRouteString(params, ['PlantId', 'plantId'], 'all');
    this.selectedProcessStatus = this.readRouteString(params, ['ProcessStatus', 'processStatus'], 'all');
    this.startDate = this.readRouteNullableString(params, ['startDate']);
    this.endDate = this.readRouteNullableString(params, ['endDate']);
    this.year = this.readRouteNumber(params, ['year']);
    this.month = this.readRouteNumber(params, ['month']);
    this.selectedYtd = this.readRouteBoolean(params, ['ytd']);
    this.selectedProjectScope = this.readProjectScope(params);
    this.dashboardReturnView = this.readDashboardReturnView(params);
    this.showDashboardBackButton = String(params['source'] ?? '').toLowerCase() === 'dashboard';
  }

  private buildDashboardReturnParams(): Record<string, string | number | boolean> {
    const queryParams: Record<string, string | number | boolean> = {};

    if (this.selectedBusinessUnitId !== 'all') queryParams['BusinessUnitId'] = this.selectedBusinessUnitId;
    if (this.selectedDepartmentId !== 'all') queryParams['DepartmentId'] = this.selectedDepartmentId;
    if (this.selectedPlantId !== 'all') queryParams['PlantId'] = this.selectedPlantId;
    if (this.selectedStatus !== 'all') queryParams['Status'] = Number(this.selectedStatus);
    if (this.selectedPhase !== 'all') queryParams['Phase'] = Number(this.selectedPhase);
    if (this.selectedManagementType !== 'all') queryParams['ProjectManagementType'] = Number(this.selectedManagementType);
    if (this.selectedProcessStatus !== 'all') queryParams['ProcessStatus'] = this.selectedProcessStatus;
    if (this.startDate) queryParams['startDate'] = this.startDate;
    if (this.endDate) queryParams['endDate'] = this.endDate;
    if (this.year) queryParams['year'] = this.year;
    if (this.month) queryParams['month'] = this.month;
    if (this.selectedYtd) queryParams['ytd'] = true;
    if (this.selectedProjectScope) queryParams['projectScope'] = this.selectedProjectScope;
    if (this.dashboardReturnView) queryParams['dashboardView'] = this.dashboardReturnView;

    return queryParams;
  }

  private getEffectiveProjectScope(): 'mine' | 'all' | null {
    if (this.selectedProjectScope) {
      return this.selectedProjectScope;
    }

    return 'all';
  }

  private readProjectScope(params: Record<string, unknown>): 'mine' | 'all' | null {
    const explicitScope = String(params['projectScope'] ?? params['ProjectScope'] ?? '').toLowerCase();
    if (explicitScope === 'mine' || explicitScope === 'my') {
      return 'mine';
    }
    if (explicitScope === 'all') {
      return 'all';
    }

    const explicitAll = params['all'] ?? params['All'];
    if (explicitAll !== undefined) {
      return String(explicitAll).toLowerCase() === 'true' ? 'all' : 'mine';
    }

    return null;
  }

  private readDashboardReturnView(params: Record<string, unknown>): 'admin' | 'mine' | 'all' | 'personal' | null {
    const view = String(params['dashboardView'] ?? params['DashboardView'] ?? '').toLowerCase();

    if (view === 'admin' || view === 'mine' || view === 'all' || view === 'personal') {
      return view;
    }

    const scope = this.readProjectScope(params);
    return scope;
  }

  private readRouteString(params: Record<string, unknown>, keys: string[], fallback: string): string {
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }

    return fallback;
  }

  private readRouteNullableString(params: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }

    return null;
  }

  private readRouteNumber(params: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    return null;
  }

  private readRouteBoolean(params: Record<string, unknown>, keys: string[]): boolean {
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        return String(value).toLowerCase() === 'true';
      }
    }

    return false;
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
      departmentName: project.departmentName || '-',
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
      isDataComplete: project.isDataComplete !== undefined ? project.isDataComplete : true,
      dataCompletionPercentage: project.dataCompletionPercentage !== undefined ? project.dataCompletionPercentage : 100,
      missingFields: project.missingFields || [],
    }));
  }

  private getVisibleProjectIds(): string[] {
    return this.paginatedProjects.map((project) => project.id);
  }

  private pruneSelection(): void {
    const currentIds = new Set(this.projects.map((project) => project.id));
    this.selectedProjectIds.forEach((id) => {
      if (!currentIds.has(id)) {
        this.selectedProjectIds.delete(id);
      }
    });
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
