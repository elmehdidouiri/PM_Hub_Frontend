import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import {
  ProcessStatus,
  ProjectDto,
  ProjectFileDto,
  ProjectFileVersionDto,
  ProjectFileType,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectStatus,
  StrategicCriterionScore,
  StrategicCriterionType,
} from '../../models';
import { ProjectFilesApiService } from '../../../../core/services/project-files-api.service';
import { FileService } from '../../../files/services/file';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth';
import { NavigationHistoryService } from '../../../../core/services/navigation-history.service';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import {
  HoursAllocationByProjectUserDto,
  HoursAllocationDashboardParams,
} from '../../../dashboard/models/hours-allocation-dashboard.models';
import { HoursAllocationDashboardService } from '../../../dashboard/services/hours-allocation-dashboard.service';

@Component({
  selector: 'app-project-detail',
  standalone: false,
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
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

  private readonly processStatusLabels: Record<ProcessStatus, string> = {
    [ProcessStatus.NotStarted]: 'Not Started',
    [ProcessStatus.AsIsProcessUnderstanding]: 'As-Is Process Understanding',
    [ProcessStatus.ToBeProcessDefinition]: 'To-Be Process Definition',
    [ProcessStatus.OnHold]: 'On Hold',
    [ProcessStatus.Completed]: 'Completed',
    [ProcessStatus.ImplementedInPDMlink]: 'Implemented In PDMlink',
    [ProcessStatus.Cancelled]: 'Cancelled',
  };

  private readonly projectTypeLabels: Record<ProjectType, string> = {
    [ProjectType.NewProject]: 'New Project',
    [ProjectType.NewPhase]: 'New Phase',
    [ProjectType.Extension]: 'Extension',
    [ProjectType.Sustain]: 'Sustain',
    [ProjectType.NewProcessProject]: 'New Process Project',
  };

  private readonly managementTypeLabels: Record<ProjectManagementType, string> = {
    [ProjectManagementType.DigitalOperation]:      'Digital Operation',
    [ProjectManagementType.DigitalSolution]:       'Digital Solution',
    [ProjectManagementType.Infrastructure]:        'Infrastructure',
    [ProjectManagementType.ProcessSimplification]: 'Process Simplification',
    [ProjectManagementType.Other]:                 'Other',
  } as Record<ProjectManagementType, string>;

  private readonly strategicCriterionLabels: Record<StrategicCriterionType, string> = {
    [StrategicCriterionType.FinancialImpact]: 'Financial Impact',
    [StrategicCriterionType.CustomerImpact]: 'Customer Impact',
    [StrategicCriterionType.OperationalEfficiency]: 'Operational Efficiency',
    [StrategicCriterionType.StrategicAlignment]: 'Strategic Alignment',
    [StrategicCriterionType.CrossFunctionalImpact]: 'Cross-Functional Impact',
    [StrategicCriterionType.InnovationDigitalisation]: 'Innovation / Digitalisation',
    [StrategicCriterionType.RiskMitigationUrgency]: 'Risk Mitigation / Urgency',
    [StrategicCriterionType.SustainabilityESG]: 'Sustainability / ESG',
  };

  readonly requiredProjectFileTypes: Array<{ value: ProjectFileType; label: string }> = [
    { value: ProjectFileType.BRD, label: 'BRD' },
    { value: ProjectFileType.FDD, label: 'FDD' },
    { value: ProjectFileType.PROCESS, label: 'PROCESS' },
    { value: ProjectFileType.UAT, label: 'UAT' },
    { value: ProjectFileType.RiskAssessment, label: 'RiskAssessment' },
    { value: ProjectFileType.Timeline, label: 'Timeline' },
    { value: ProjectFileType.StrategicEvaluation, label: 'StrategicEvaluation' },
    { value: ProjectFileType.OnePager, label: 'OnePager' },
    { value: ProjectFileType.SharePoint, label: 'SharePoint' },
    { value: ProjectFileType.SAPApproval, label: 'SAPApproval' },
    { value: ProjectFileType.Compliance, label: 'Compliance' },
  ];

  project?: ProjectDto;
  projectFiles: ProjectFileDto[] = [];
  isLoadingFiles = false;
  fileLoadError = '';
  showAllocations = false;
  isLoadingAllocations = false;
  allocationLoadError = '';
  allocationSearch = '';
  projectAllocations: HoursAllocationByProjectUserDto[] = [];

  // File management state
  isUploading: Record<number, boolean> = {};
  isUploadingVersion: Record<string, boolean> = {};
  isSavingDescription: Record<string, boolean> = {};
  isDeleting: Record<string, boolean> = {};
  editingDescriptionFileId: string | null = null;
  descriptionEditValue = '';
  expandedHistoryFileId: string | null = null;
  fileVersions: Record<string, ProjectFileVersionDto[]> = {};
  isLoadingVersions: Record<string, boolean> = {};

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly projectFilesApi: ProjectFilesApiService,
    private readonly hoursAllocationDashboard: HoursAllocationDashboardService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly navigationHistory: NavigationHistoryService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.project = this.route.snapshot.data['project'] as ProjectDto | undefined;
    if (this.project?.id) {
      this.loadProjectFiles(this.project.id);
    }
  }

  backToList(): void {
    void this.navigationHistory.back(this.projectsBasePath());
  }

  editProject(): void {
    if (!this.isAdmin || !this.project) {
      return;
    }

    this.router.navigate(['/admin/projects', this.project.id, 'edit']);
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  toggleAllocations(): void {
    this.showAllocations = !this.showAllocations;

    if (this.showAllocations && !this.projectAllocations.length && !this.isLoadingAllocations) {
      this.loadProjectAllocations();
    }
  }

  searchAllocations(): void {
    this.loadProjectAllocations();
  }

  clearAllocationSearch(): void {
    if (!this.allocationSearch.trim()) {
      return;
    }

    this.allocationSearch = '';
    this.loadProjectAllocations();
  }

  getProgress(project: ProjectDto): number {
    const value = Number(project.progressPercentage ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  getProgressTone(project: ProjectDto): 'low' | 'mid' | 'high' {
    const progress = this.getProgress(project);
    if (progress < 40) {
      return 'low';
    }
    if (progress < 75) {
      return 'mid';
    }
    return 'high';
  }

  getStatusTone(project: ProjectDto): 'planned' | 'ongoing' | 'onhold' | 'done' {
    switch (project.status) {
      case ProjectStatus.Planned:
        return 'planned';
      case ProjectStatus.OnHold:
        return 'onhold';
      case ProjectStatus.Done:
        return 'done';
      case ProjectStatus.Ongoing:
      default:
        return 'ongoing';
    }
  }

  getMomentumTone(project: ProjectDto): 'early' | 'steady' | 'advanced' {
    const progress = this.getProgress(project);
    if (progress < 35) {
      return 'early';
    }
    if (progress < 75) {
      return 'steady';
    }
    return 'advanced';
  }

  getInitials(value: string | null | undefined): string {
    const words = (value || 'Project')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  getResourceTotal(project: ProjectDto): number {
    return (project.projectResources || []).reduce((total, resource) => {
      const explicitTotal = Number(resource.totalCost);
      if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
        return total + explicitTotal;
      }

      return total + (Number(resource.pricePerUnit) || 0) * (Number(resource.quantity) || 0);
    }, 0);
  }

  getAllocationTotalHours(): number {
    return this.projectAllocations.reduce((total, item) => total + item.totalHours, 0);
  }

  getAllocationWorkedDays(): number {
    return this.projectAllocations.reduce((total, item) => total + item.workedDays, 0);
  }

  getAllocationCount(): number {
    return this.projectAllocations.reduce((total, item) => total + item.allocationCount, 0);
  }

  getProjectManagerAllocationCount(): number {
    return this.projectAllocations.filter((item) => item.isProjectManager).length;
  }

  getAverageHoursPerContributor(): number {
    if (!this.projectAllocations.length) {
      return 0;
    }

    return this.getAllocationTotalHours() / this.projectAllocations.length;
  }

  getMaxAllocationHours(): number {
    return Math.max(1, ...this.projectAllocations.map((item) => item.totalHours));
  }

  getAllocationShare(item: HoursAllocationByProjectUserDto): number {
    return Math.max(0, Math.min(100, (item.totalHours / this.getMaxAllocationHours()) * 100));
  }

  getDominantAllocationType(item: HoursAllocationByProjectUserDto): string {
    const categories = [
      { label: 'Execution', value: item.executionHours },
      { label: 'Tech Lead', value: item.techLeadHours },
      { label: 'Process', value: item.processHours },
      { label: 'PM', value: item.projectManagementHours },
      { label: 'R&D', value: item.researchAndDevHours },
      { label: 'Workshop', value: item.workshopHours },
      { label: 'Other', value: item.otherHours },
    ];
    const best = categories.sort((a, b) => b.value - a.value)[0];
    return best?.value > 0 ? best.label : 'No split';
  }

  getSortedAllocations(): HoursAllocationByProjectUserDto[] {
    return [...this.projectAllocations].sort((a, b) => b.totalHours - a.totalHours);
  }

  getAllocationActivityBreakdown(): Array<{ label: string; value: number; icon: string }> {
    const totals = this.projectAllocations.reduce(
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
      {
        execution: 0,
        techLead: 0,
        process: 0,
        projectManagement: 0,
        researchAndDev: 0,
        workshop: 0,
        other: 0,
      }
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

  getAllocationActivityShare(value: number): number {
    const total = this.getAllocationActivityBreakdown().reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return 0;
    }

    return Math.max(0, Math.min(100, (value / total) * 100));
  }

  getDueDateHint(project: ProjectDto): string {
    if (!project.estimatedDueDate) {
      return '(vide)';
    }

    const due = new Date(project.estimatedDueDate);
    if (Number.isNaN(due.getTime())) {
      return 'Invalid due date';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) {
      return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    }

    if (days === 0) {
      return 'Due today';
    }

    return `${days} day${days === 1 ? '' : 's'} remaining`;
  }

  getStrategicAverage(project: ProjectDto): string {
    const criteria = project.strategicCriteria || [];
    if (!criteria.length) {
      return '(vide)';
    }

    const average = criteria.reduce((total, item) => total + (Number(item.score) || 0), 0) / criteria.length;
    return `${Math.round(average * 10) / 10}/10`;
  }

  getStrategicScorePercent(score: number | null): number {
    const value = Number(score ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, (value / 10) * 100));
  }

  getRecordLabel(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return this.displayValue(value);
    }

    const record = value as Record<string, unknown>;
    const label =
      this.readString(record, [
        'internName',
        'InternName',
        'fullName',
        'FullName',
        'userName',
        'UserName',
        'name',
        'Name',
        'title',
        'Title',
        'label',
        'Label',
        'description',
        'Description',
        'currentState',
        'CurrentState',
        'roadblock',
        'Roadblock',
        'summary',
        'Summary',
      ]);

    return label || this.getDisplayRecordParts(record)[0] || 'Item';
  }

  getRecordMeta(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const record = value as Record<string, unknown>;
    const metaParts = [
      this.readString(record, ['roleName', 'RoleName', 'statusLabel', 'StatusLabel', 'phaseLabel', 'PhaseLabel', 'fileTypeLabel', 'FileTypeLabel', 'typeLabel', 'TypeLabel']),
      this.formatHours(record['allocatedHours'] ?? record['AllocatedHours'], 'allocated'),
      this.formatHours(record['hoursWorked'] ?? record['HoursWorked'], 'worked'),
      this.readString(record, ['supervisorName', 'SupervisorName']),
      this.readString(record, ['createdAt', 'CreatedAt', 'updatedAt', 'UpdatedAt', 'joinedAt', 'JoinedAt']),
    ].filter(Boolean);

    return metaParts.length ? metaParts.join(' | ') : this.getDisplayRecordParts(record).slice(1).join(' | ');
  }

  displayValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '(vide)';
    }

    if (typeof value === 'string') {
      return value.trim() || '(vide)';
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '(vide)';
    }

    return String(value) || '(vide)';
  }

  splitTextItems(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/\r?\n|[;]+/g)
      .map((item) => item.trim())
      .filter((item) => !!item);
  }

  private projectsBasePath(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.includes('/admin/projects') ? '/admin/projects' : '/projects';
  }

  getStatusLabel(project: ProjectDto): string {
    return project.statusLabel || this.statusLabels[project.status] || String(project.status);
  }

  getPhaseLabel(project: ProjectDto): string {
    return project.phaseLabel || this.phaseLabels[project.phase] || String(project.phase);
  }

  getProcessStatusLabel(project: ProjectDto): string {
    return project.processStatusLabel || this.processStatusLabels[project.processStatus] || String(project.processStatus);
  }

  getProjectManagementTypeLabel(project: ProjectDto): string {
    const value = project.projectManagementType;
    if (value !== undefined && value !== null && this.managementTypeLabels[value]) {
      return this.managementTypeLabels[value];
    }
    const label = project.projectManagementTypeLabel;
    if (label && label.toLowerCase() !== 'development') return label;
    return value !== undefined && value !== null ? `Category ${value}` : '(vide)';
  }

  getProjectTypeLabel(project: ProjectDto): string {
    const value = project.projectType as unknown as ProjectType;
    if (value !== undefined && value !== null && this.projectTypeLabels[value]) {
      return this.projectTypeLabels[value];
    }
    const label = project.projectTypeLabel;
    if (label && label.toLowerCase() !== 'development') return label;
    return value !== undefined && value !== null ? `Type ${value}` : '(vide)';
  }

  getStrategicCriterionLabel(type: number): string {
    return this.strategicCriterionLabels[type as StrategicCriterionType] || `Type ${type}`;
  }

  getStrategicScoreLabel(score: number | null): string {
    if (score === null || score === undefined) {
      return '(vide)';
    }
    if (score === StrategicCriterionScore.Low) {
      return 'Low (1)';
    }
    if (score === StrategicCriterionScore.Medium) {
      return 'Medium (3)';
    }
    if (score === StrategicCriterionScore.High) {
      return 'High (5)';
    }
    return String(score);
  }

  hasParentProject(project: ProjectDto): boolean {
    const name = (project.parentProjectName ?? '').trim();
    if (!name) {
      return false;
    }
    return name.toLowerCase() !== 'n/a';
  }

  getProjectKpis(project: ProjectDto): ProjectDto['KPIs'] {
    return project.kpis ?? project.KPIs ?? project.kpIs ?? [];
  }

  getDocumentCompletionCount(): number {
    const present = new Set(this.projectFiles.map((file) => this.normalizeFileTypeLabel(file)));
    return this.requiredProjectFileTypes.filter((type) => present.has(type.label.toLowerCase())).length;
  }

  getMissingProjectFileTypes(): string[] {
    const present = new Set(this.projectFiles.map((file) => this.normalizeFileTypeLabel(file)));
    return this.requiredProjectFileTypes
      .filter((type) => !present.has(type.label.toLowerCase()))
      .map((type) => type.label);
  }

  hasProjectFileType(label: string): boolean {
    const normalized = label.toLowerCase();
    return this.projectFiles.some((file) => this.normalizeFileTypeLabel(file) === normalized);
  }

  private loadProjectFiles(projectId: string): void {
    this.isLoadingFiles = true;
    this.fileLoadError = '';
    this.projectFilesApi
      .list(projectId)
      .pipe(
        catchError(() => {
          this.fileLoadError = 'Unable to load project files.';
          return of([] as unknown[]);
        })
      )
      .subscribe((files) => {
        this.projectFiles = [...(files as ProjectFileDto[])];
        this.isLoadingFiles = false;
        this.cdr.detectChanges();
      });
  }

  private loadProjectAllocations(): void {
    const projectId = this.project?.id;
    if (!projectId) {
      return;
    }

    const params: HoursAllocationDashboardParams = {
      analysis: 'projectUsers',
      projectId,
      search: this.allocationSearch.trim() || null,
      all: true,
    };

    this.isLoadingAllocations = true;
    this.allocationLoadError = '';

    this.hoursAllocationDashboard
      .getDashboard(params)
      .pipe(
        catchError(() => {
          this.allocationLoadError = 'Unable to load project allocations.';
          return of(null);
        }),
        finalize(() => {
          this.isLoadingAllocations = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((dashboard) => {
        this.projectAllocations = dashboard?.hoursByProjectUser ?? [];
      });
  }

  private normalizeFileTypeLabel(file: ProjectFileDto): string {
    const label = (file.fileTypeLabel || '').trim();
    if (label) {
      return label.toLowerCase();
    }

    const enumLabel = this.requiredProjectFileTypes.find((type) => type.value === file.fileType)?.label || '';
    return enumLabel.toLowerCase();
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return '';
  }

  private getDisplayRecordParts(record: Record<string, unknown>): string[] {
    return Object.entries(record)
      .filter(([key, value]) => !this.isIdKey(key) && this.isDisplayPrimitive(value))
      .map(([key, value]) => `${this.humanizeKey(key)}: ${this.displayValue(value)}`)
      .filter((part) => !part.endsWith(': (vide)'));
  }

  private isIdKey(key: string): boolean {
    return key.toLowerCase() === 'id' || key.toLowerCase().endsWith('id');
  }

  private isDisplayPrimitive(value: unknown): value is string | number | boolean {
    return ['string', 'number', 'boolean'].includes(typeof value);
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  private formatHours(value: unknown, label: string): string {
    const hours = Number(value);
    return Number.isFinite(hours) && hours > 0 ? `${hours}h ${label}` : '';
  }

  getFileByType(typeVal: ProjectFileType): ProjectFileDto | undefined {
    return this.projectFiles.find((f) => f.fileType === typeVal);
  }

  onUploadFile(event: Event, fileType: ProjectFileType): void {
    if (!this.isAdmin) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.project?.id) return;

    if (file.size > 10 * 1024 * 1024) {
      this.notificationService.showWarning('The file size cannot exceed 10 MB.');
      input.value = '';
      return;
    }

    this.isUploading[fileType] = true;
    const description = prompt("Entrez une description optionnelle pour ce fichier :") || '';

    this.fileService.upload(this.project.id, {
      file,
      fileType,
      description: description.trim() || null
    }).subscribe({
      next: () => {
        this.isUploading[fileType] = false;
        input.value = '';
        this.notificationService.showSuccess('Fichier importé avec succès.');
        if (this.project?.id) {
          this.loadProjectFiles(this.project.id);
        }
      },
      error: () => {
        this.isUploading[fileType] = false;
        input.value = '';
        this.notificationService.showError("Unable to upload the file.");
      }
    });
  }

  onUploadNewVersion(event: Event, file: ProjectFileDto): void {
    if (!this.isAdmin) return;
    const input = event.target as HTMLInputElement;
    const newFile = input.files?.[0];
    if (!newFile || !this.project?.id) return;

    if (newFile.size > 10 * 1024 * 1024) {
      this.notificationService.showWarning('The file size cannot exceed 10 MB.');
      input.value = '';
      return;
    }

    this.isUploadingVersion[file.id] = true;
    const description = prompt('Enter an optional version note:') || '';

    this.fileService.uploadVersion(this.project.id, file.id, {
      file: newFile,
      description: description.trim() || null
    }).subscribe({
      next: () => {
        this.isUploadingVersion[file.id] = false;
        input.value = '';
        this.notificationService.showSuccess('New version uploaded successfully.');
        if (this.project?.id) {
          this.loadProjectFiles(this.project.id);
        }
        if (this.expandedHistoryFileId === file.id) {
          this.loadVersions(file.id);
        }
      },
      error: () => {
        this.isUploadingVersion[file.id] = false;
        input.value = '';
        this.notificationService.showSuccess('New version uploaded successfully.');
      }
    });
  }

  downloadFile(file: ProjectFileDto | ProjectFileVersionDto): void {
    if (!this.project?.id) return;
    this.fileService.download(this.project.id, file.id).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = file.originalFileName || 'download';
        anchor.click();
        window.URL.revokeObjectURL(blobUrl);
      },
      error: () => {
        this.notificationService.showError("Unable to download the file.");
      }
    });
  }

  deleteFile(file: ProjectFileDto): void {
    if (!this.isAdmin) return;
    if (!this.project?.id) return;

    const data: ConfirmationDialogData = {
      title: 'Delete project file',
      message: `Are you sure you want to delete "${file.originalFileName}"? This will permanently delete the file and all archived versions.`,
      icon: 'delete_sweep',
      saveLabel: 'Delete',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'save') {
        this.isDeleting[file.id] = true;
        this.fileService.delete(this.project!.id, file.id).subscribe({
          next: () => {
            this.isDeleting[file.id] = false;
            this.notificationService.showSuccess('File deleted successfully.');
            this.loadProjectFiles(this.project!.id);
            if (this.expandedHistoryFileId === file.id) {
              this.expandedHistoryFileId = null;
            }
          },
          error: () => {
            this.isDeleting[file.id] = false;
            this.notificationService.showError('Unable to delete the file.');
          }
        });
      }
    });
  }

  startEditingDescription(file: ProjectFileDto): void {
    if (!this.isAdmin) return;
    this.editingDescriptionFileId = file.id;
    this.descriptionEditValue = file.description || '';
  }

  cancelEditingDescription(): void {
    this.editingDescriptionFileId = null;
    this.descriptionEditValue = '';
  }

  saveDescription(file: ProjectFileDto): void {
    if (!this.isAdmin) return;
    if (!this.project?.id) return;
    this.isSavingDescription[file.id] = true;
    this.fileService.update(this.project.id, file.id, {
      description: this.descriptionEditValue.trim() || null
    }).subscribe({
      next: () => {
        this.isSavingDescription[file.id] = false;
        this.editingDescriptionFileId = null;
        this.notificationService.showSuccess('Description updated.');
        this.loadProjectFiles(this.project!.id);
      },
      error: () => {
        this.isSavingDescription[file.id] = false;
        this.notificationService.showError('Unable to update the description.');
      }
    });
  }

  toggleVersionsHistory(file: ProjectFileDto): void {
    if (this.expandedHistoryFileId === file.id) {
      this.expandedHistoryFileId = null;
      return;
    }
    this.expandedHistoryFileId = file.id;
    this.loadVersions(file.id);
  }

  loadVersions(fileId: string): void {
    if (!this.project?.id) return;
    this.isLoadingVersions[fileId] = true;
    this.fileService.listVersions(this.project.id, fileId).subscribe({
      next: (versions) => {
        this.fileVersions[fileId] = (versions as ProjectFileVersionDto[]).sort((a, b) => b.versionNumber - a.versionNumber);
        this.isLoadingVersions[fileId] = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingVersions[fileId] = false;
        this.cdr.detectChanges();
      }
    });
  }
}
