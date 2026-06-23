import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth';
import { HourEntriesApiService } from '../../../../core/services/hour-entries-api.service';
import { HourEntryDto } from '../../../../core/models/hour-entry.model';
import { InternDto } from '../../../interns/models/intern.models';
import { InternService } from '../../../interns/services/intern';
import {
  ProjectDto,
  ProcessStatus,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectReferenceData,
  ProjectStatus,
  SelectOption,
  ProjectFileDto,
  ProjectFileVersionDto,
  ProjectFileType,
} from '../../models';
import { ProjectReferenceService } from '../../services/project-reference.service';
import { ProjectService } from '../../services/project';
import { ProjectFilesApiService } from '../../../../core/services/project-files-api.service';
import { FileService } from '../../../files/services/file';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import {
  HoursAllocationByProjectUserDto,
  HoursAllocationDashboardDto,
  HoursAllocationDashboardParams,
} from '../../../dashboard/models/hours-allocation-dashboard.models';
import { HoursAllocationDashboardService } from '../../../dashboard/services/hours-allocation-dashboard.service';

@Component({
  selector: 'app-project-edit-page',
  standalone: false,
  templateUrl: './project-edit-page.html',
  styleUrls: ['./project-edit-page.scss'],
})
export class ProjectEditPage implements OnInit {
  mode: 'details' | 'edit' = 'details';
  public readonly ProjectPhase = ProjectPhase;
  public readonly ProjectStatus = ProjectStatus;
  public readonly ProcessStatus = ProcessStatus;

  project!: ProjectDto;
  references: ProjectReferenceData = {
    departments: [],
    plants: [],
    businessUnits: [],
    technologies: [],
    solutionDomains: [],
    users: [],
    roles: [],
    parentProjects: [],
  };

  editingSection: string | null = null;
  isSaving = false;

  // Section forms
  identityForm!: FormGroup;
  statusForm!: FormGroup;
  timelineForm!: FormGroup;
  financialForm!: FormGroup;
  contextForm!: FormGroup;
  strategicForm!: FormGroup;
  teamForm!: FormGroup;
  budgetForm!: FormGroup;
  kpiForm!: FormGroup;
  collectionsForm!: FormGroup;

  // Draft controls
  memberDraft: FormGroup;
  budgetDraft: FormGroup;
  roadblockDraft: FormControl<string>;
  businessUnitDraft: FormControl<string>;
  kpiDraft!: FormGroup;
  internMemberDraft = new FormControl('', { nonNullable: true });
  interns: InternDto[] = [];
  isLoadingInterns = false;
  deletingTeamMemberIds = new Set<string>();

  // File and Allocation state
  projectFiles: ProjectFileDto[] = [];
  isLoadingFiles = false;
  fileLoadError = '';
  showAllocations = true;
  isLoadingAllocations = false;
  allocationLoadError = '';
  allocationSearch = '';
  projectAllocations: HoursAllocationByProjectUserDto[] = [];

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

  isUploading: Record<number, boolean> = {};
  isUploadingVersion: Record<string, boolean> = {};
  isSavingDescription: Record<string, boolean> = {};
  isDeleting: Record<string, boolean> = {};
  editingDescriptionFileId: string | null = null;
  descriptionEditValue = '';
  pendingProjectFileUpload: { file: File; fileType: ProjectFileType; fileTypeLabel: string } | null = null;
  pendingProjectVersionUpload: { file: File; currentFile: ProjectFileDto } | null = null;
  projectFileMessageDraft = '';
  expandedHistoryFileId: string | null = null;
  fileVersions: Record<string, ProjectFileVersionDto[]> = {};
  isLoadingVersions: Record<string, boolean> = {};

  readonly collectionKeys = ['internMembers', 'subProjects', 'timelineEntries', 'roadblockEntries'] as const;

  readonly projectTypeOptions = [
    { value: ProjectType.NewProject, label: 'New Project' },
    { value: ProjectType.NewPhase, label: 'New Phase' },
    { value: ProjectType.Extension, label: 'Extension' },
    { value: ProjectType.Sustain, label: 'Sustain' },
    { value: ProjectType.NewProcessProject, label: 'New Process Project' },
  ];

  readonly projectManagementTypeOptions = [
    { value: ProjectManagementType.DigitalOperation,      label: 'Digital Operation' },
    { value: ProjectManagementType.DigitalSolution,       label: 'Digital Solution' },
    { value: ProjectManagementType.Infrastructure,        label: 'Infrastructure' },
    { value: ProjectManagementType.ProcessSimplification, label: 'Process Simplification' },
    { value: ProjectManagementType.Other,                 label: 'Other' },
  ];

  readonly phaseOptions = Object.values(ProjectPhase).filter((v): v is ProjectPhase => typeof v === 'number');
  readonly statusOptions = Object.values(ProjectStatus).filter((v): v is ProjectStatus => typeof v === 'number');
  readonly processStatusOptions = Object.values(ProcessStatus).filter((v): v is ProcessStatus => typeof v === 'number');
  private formSubscriptions = new Subscription();
  private routeDataSubscription?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly projectService: ProjectService,
    private readonly referenceService: ProjectReferenceService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: AuthService,
    private readonly projectFilesApi: ProjectFilesApiService,
    private readonly hoursAllocationDashboard: HoursAllocationDashboardService,
    private readonly hourEntriesApi: HourEntriesApiService,
    private readonly internService: InternService,
    private readonly fileService: FileService,
    private readonly dialog: MatDialog
  ) {
    this.memberDraft = this.fb.group({
      userId: this.fb.nonNullable.control('', Validators.required),
      role: this.fb.nonNullable.control('', Validators.required),
      roleId: this.fb.nonNullable.control(''),
    });

    this.budgetDraft = this.fb.group({
      itemName: this.fb.nonNullable.control('', Validators.required),
      pricePerUnit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
      costCenter: [''],
    });

    this.roadblockDraft = this.fb.nonNullable.control('');
    this.businessUnitDraft = this.fb.nonNullable.control('');
  }

  ngOnInit(): void {
    this.routeDataSubscription = this.route.data.subscribe(data => {
      this.mode = data['mode'] || 'details';
      this.applyResolvedProjectData(data);
    });

    this.memberDraft.controls['userId'].valueChanges.subscribe((userId) => this.syncMemberRole(userId));
  }

  ngOnDestroy(): void {
    this.formSubscriptions.unsubscribe();
    this.routeDataSubscription?.unsubscribe();
  }

  private applyResolvedProjectData(data: Record<string, unknown>): void {
    const project = data['project'] as ProjectDto | null | undefined;
    const refs = data['refs'] as ProjectReferenceData | null | undefined;

    if (!project) {
      return;
    }

    this.project = this.normalizeProjectResponse(project);
    if (refs) {
      this.references = refs;
    }

    this.editingSection = null;
    this.initForms();
    if (this.isAdmin) {
      this.loadInterns();
    }
    if (this.project?.id) {
      this.loadProjectMembers(this.project.id);
      this.loadProjectFiles(this.project.id);
      if (this.showAllocations) {
        this.loadProjectAllocations();
      }
    }
    this.cdr.detectChanges();
  }

  initForms(): void {
    // ── Identity & Governance ──
    this.identityForm = this.fb.group({
      name: [this.project.name, Validators.required],
      description: [this.project.description],
      projectType: [this.project.projectType, Validators.required],
      projectManagementType: [this.project.projectManagementType, Validators.required],
      projectManagerId: [this.project.projectManagerId],
      sponsor: [this.project.sponsor],
      departmentId: [this.project.departmentId, Validators.required],
      plantName: [this.project.plantName],
      parentProjectId: [this.project.parentProjectId],
      costCenter: [this.project.costCenter],
      serverHostName: [this.project.serverHostName],
      businessUnitIds: [this.project.businessUnits?.map(l => this.findReferenceId('businessUnits', l)) || []],
      technologyIds: [this.project.technologies?.map(l => this.findReferenceId('technologies', l)) || []],
      solutionDomainIds: [this.project.solutionDomains?.map(l => this.findReferenceId('solutionDomains', l)) || []],
    }, { validators: this.identityValidator });
    this.formSubscriptions.unsubscribe();
    this.formSubscriptions = new Subscription();
    this.formSubscriptions.add(
      this.identityForm.controls['projectManagerId'].valueChanges.subscribe((pmUserId) => this.onProjectManagerChange(pmUserId))
    );
    this.formSubscriptions.add(
      this.identityForm.controls['projectType'].valueChanges.subscribe(() => this.updateIdentityDynamicValidators())
    );
    this.updateIdentityDynamicValidators();

    // ── Execution State (Status & Phase) ──
    this.statusForm = this.fb.group({
      status: [this.project.status, Validators.required],
      phase: [this.project.phase, Validators.required],
      processStatus: [this.project.processStatus],
      progressPercentage: [this.project.progressPercentage || 0, [Validators.min(0), Validators.max(100)]]
    }, { validators: this.phaseStatusValidator });

    // ── Timeline & Effort ──
    this.timelineForm = this.fb.group({
      startDate: [this.formatDateForInput(this.project.startDate), Validators.required],
      endDate: [this.formatDateForInput(this.project.endDate)],
      estimatedDueDate: [this.formatDateForInput(this.project.estimatedDueDate)],
      estimatedHours: [this.project.estimatedHours, Validators.min(0)],
      actualHours: [this.project.actualHours, Validators.min(0)],
    }, { validators: this.dateValidator });

    // ── Financial ──
    this.financialForm = this.fb.group({
      budget: [this.project.budget, Validators.min(0)],
      costSaving: [this.project.costSaving, Validators.min(0)],
      digitalContribution: [this.project.digitalContribution],
    });

    // ── Strategic Criteria (all 8 from StrategicCriteriaDto) ──
    const sc = this.project.strategicCriteria || [];
    this.strategicForm = this.fb.group({
      financialImpact: [this.getStrategicScore(sc, 1), [Validators.min(0), Validators.max(10)]],
      customerImpact: [this.getStrategicScore(sc, 2), [Validators.min(0), Validators.max(10)]],
      operationalEfficiency: [this.getStrategicScore(sc, 3), [Validators.min(0), Validators.max(10)]],
      strategicAlignment: [this.getStrategicScore(sc, 4), [Validators.min(0), Validators.max(10)]],
      crossFunctionalImpact: [this.getStrategicScore(sc, 5), [Validators.min(0), Validators.max(10)]],
      innovationDigitalisation: [this.getStrategicScore(sc, 6), [Validators.min(0), Validators.max(10)]],
      riskMitigationUrgency: [this.getStrategicScore(sc, 7), [Validators.min(0), Validators.max(10)]],
      sustainabilityESG: [this.getStrategicScore(sc, 8), [Validators.min(0), Validators.max(10)]],
    });

    // ── Context, Roadblocks & Links ──
    this.contextForm = this.fb.group({
      currentState: [this.project.currentState],
      nextSteps: [this.project.nextSteps],
      enhancements: [this.project.enhancements],
      roadblocks: this.fb.array(this.splitRoadblocks(this.project.roadblocks).map(r => this.fb.control(r))),
      codeSourceLink: [this.project.codeSourceLink],
      solutionLink: [this.project.solutionLink],
    });

    // ── Team Members ──
    this.teamForm = this.fb.group({
      teamMembers: this.fb.array(this.normalizedProjectMembers(this.project).filter((m) => m.userId !== this.project.projectManagerId).map(m => this.fb.group({
        userId: [m.userId, Validators.required],
        role: [m.roleName || this.roleNameForUser(m.userId, m.roleId), Validators.required],
        roleId: [m.roleId || '']
      }))),
      internMembers: this.fb.array(this.toJsonControls(this.project.internMembers))
    });

    // ── Budget / Resources ──
    this.budgetForm = this.fb.group({
      budgetItems: this.fb.array((this.project.projectResources || []).map(r => this.fb.group({
        itemName: [r.itemName, Validators.required],
        pricePerUnit: [r.pricePerUnit, [Validators.required, Validators.min(0)]],
        quantity: [r.quantity, [Validators.required, Validators.min(1)]],
        costCenter: [r.costCenter || ''],
      })))
    });

    // ── KPIs (all fields from ProjectKpiPayload) ──
    this.kpiForm = this.fb.group({
      kpis: this.fb.array(this.getProjectKpis().map(k => this.fb.group({
        name: [k.name, Validators.required],
        targetValue: [k.targetValue],
        currentValue: [k.currentValue],
        estimatedDueDate: [this.formatDateForInput(k.estimatedDueDate)],
        actualEndDate: [this.formatDateForInput(k.actualEndDate)],
        estimatedHours: [k.estimatedHours],
        actualHours: [k.actualHours],
        description: [k.description],
      })))
    });

    this.collectionsForm = this.fb.group({});

    this.kpiDraft = this.fb.group({
      name: ['', Validators.required],
      targetValue: [null],
      currentValue: [null],
      estimatedDueDate: [''],
      actualEndDate: [''],
      estimatedHours: [null],
      actualHours: [null],
      description: [''],
    });
  }

  // ── Load deliverables (separate endpoint) ──
  // ── Helpers ──
  public getStrategicScore(criteria: any[], type: number): number {
    const found = (criteria || []).find(c => c.type === type);
    return found ? found.score : 0;
  }

  public splitRoadblocks(roadblocks: string): string[] {
    if (!roadblocks) return [];
    return roadblocks.split(',').map(r => r.trim()).filter(Boolean);
  }

  private findReferenceId(key: keyof ProjectReferenceData, label: string): string {
    const list = this.references[key] as SelectOption[];
    const found = list.find(item => item.label === label);
    return found ? found.id : label;
  }

  private formatDateForInput(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  // ── UI Actions ──
  toggleEdit(section: string): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingSection = (this.editingSection === section) ? null : section;
  }

  cancelEdit(): void {
    this.editingSection = null;
    this.initForms();
  }

  saveSection(section: string): void {
    if (this.isSaving) {
      return;
    }

    if (!this.isAdmin) {
      this.notificationService.showWarning('Only administrators can modify projects.');
      return;
    }

    const form = this.getFormBySection(section);
    if (form && form.invalid) {
      form.markAllAsTouched();
      if (section === 'status' && form.errors?.['invalidPhaseStatus']) {
        this.notificationService.showWarning(this.phaseStatusError());
      } else if (section === 'identity' && form.errors?.['parentProjectRequired']) {
        this.notificationService.showWarning('Parent project is required for New Phase, Extension and Sustain projects.');
      } else if (section === 'identity' && form.errors?.['parentProjectForbidden']) {
        this.notificationService.showWarning('Parent project is only allowed for New Phase, Extension and Sustain projects.');
      } else if (section === 'identity' && form.errors?.['parentProjectSelf']) {
        this.notificationService.showWarning('A project cannot be its own parent.');
      } else if (section === 'timeline' && form.errors?.['endDateInvalid']) {
        this.notificationService.showWarning('Project end date must be strictly after the start date.');
      } else if (section === 'timeline' && form.errors?.['estimatedDateInvalid']) {
        this.notificationService.showWarning('Estimated due date must be strictly after the start date.');
      }
      return;
    }

    const payload = this.buildUpdatePayload(section);
    if (section === 'team') {
      this.saveTeamSection(payload);
      return;
    }

    this.isSaving = true;
    this.projectService.patchProject(this.project.id, payload).subscribe({
      next: (updated) => this.handleSaveSuccess(updated),
      error: () => this.handleSaveError()
    });
  }

  private handleSaveSuccess(updatedProject: ProjectDto): void {
    this.project = this.normalizeProjectResponse(updatedProject);
    this.isSaving = false;
    this.editingSection = null;
    this.notificationService.showSuccess('Project updated successfully.');
    this.initForms();
    this.cdr.detectChanges();
  }

  private handleSaveError(): void {
    this.isSaving = false;
    this.notificationService.showError('Unable to update project.');
  }

  private saveTeamSection(payload: Record<string, unknown>): void {
    this.isSaving = true;
    this.projectService.getProjectMembers(this.project.id).pipe(
      switchMap((freshMembers) => {
        const changes = this.buildMemberSyncChanges(freshMembers, payload);
        const removals$ = changes.removedUserIds.length
          ? forkJoin(changes.removedUserIds.map((userId) => this.projectService.removeMember(this.project.id, userId)))
          : of([]);

        return removals$.pipe(
          switchMap(() => changes.addedMembers.length
            ? forkJoin(changes.addedMembers.map((member) => this.projectService.addMember(this.project.id, member)))
            : of([])
          ),
          switchMap(() => forkJoin({
            project: this.projectService.getProject(this.project.id),
            members: this.projectService.getProjectMembers(this.project.id),
          })),
          map(({ project, members }) => ({
            ...project,
            members,
          } as ProjectDto))
        );
      })
    ).subscribe({
      next: (updated) => this.handleSaveSuccess(updated),
      error: () => this.handleSaveError()
    });
  }

  private getFormBySection(section: string): FormGroup | null {
    const map: Record<string, FormGroup> = {
      identity: this.identityForm,
      status: this.statusForm,
      timeline: this.timelineForm,
      financial: this.financialForm,
      context: this.contextForm,
      strategic: this.strategicForm,
      team: this.teamForm,
      budget: this.budgetForm,
      kpis: this.kpiForm,
      collections: this.collectionsForm,
    };
    return map[section] || null;
  }

  private buildUpdatePayload(section: string): Record<string, unknown> {
    switch (section) {
      case 'identity': {
        const identity = this.identityForm.getRawValue();
        const parentProjectId = this.requiresParentProject(identity.projectType)
          ? this.nullIfEmptyGuid(identity.parentProjectId)
          : null;
        return {
          ...identity,
          description: identity.description || '',
          sponsor: identity.sponsor || '',
          costCenter: identity.costCenter || '',
          serverHostName: identity.serverHostName || '',
          parentProjectId,
        };
      }

      case 'status': {
        const status = this.statusForm.getRawValue();
        return {
          status: Number(status.status),
          phase: Number(status.phase),
          processStatus: status.processStatus === null || status.processStatus === ''
            ? null
            : Number(status.processStatus),
          progressPercentage: Number(status.progressPercentage) || 0,
        };
      }

      case 'timeline': {
        const timeline = this.timelineForm.getRawValue();
        return {
          startDate: this.toNullableDate(timeline.startDate),
          endDate: this.toNullableDate(timeline.endDate),
          estimatedDueDate: this.toNullableDate(timeline.estimatedDueDate),
          estimatedHours: this.toNullableNumber(timeline.estimatedHours),
          actualHours: this.toNullableNumber(timeline.actualHours),
        };
      }

      case 'financial': {
        const financial = this.financialForm.getRawValue();
        return {
          budget: this.toNumber(financial.budget),
          costSaving: this.toNumber(financial.costSaving),
          digitalContribution: this.toNumber(financial.digitalContribution),
        };
      }

      case 'context': {
        const context = this.contextForm.getRawValue();
        return {
          currentState: context.currentState || '',
          nextSteps: context.nextSteps || '',
          enhancements: context.enhancements || '',
          codeSourceLink: context.codeSourceLink || '',
          solutionLink: context.solutionLink || '',
          roadblocks: context.roadblocks?.join(', ') || '',
        };
      }

      case 'strategic':
        return {
          strategicCriteria: this.toStrategicCriteriaPayload(this.strategicForm.getRawValue()),
        };

      case 'team': {
        const team = this.teamForm.getRawValue();
        const projectManagerId = this.identityForm.get('projectManagerId')?.value;
        return {
          teamMembers: (team.teamMembers || [])
            .filter((member: { userId?: string }) => member.userId && member.userId !== projectManagerId)
            .map((member: { userId: string; roleId?: string }) => ({
              userId: member.userId,
              roleId: member.roleId || this.roleIdForUser(member.userId),
            })),
          internMembers: this.parseJsonList(team.internMembers),
        };
      }

      case 'budget': {
        const budget = this.budgetForm.getRawValue();
        return {
          projectResources: (budget.budgetItems || []).map((item: any) => ({
            itemName: item.itemName,
            pricePerUnit: this.toNumber(item.pricePerUnit),
            quantity: this.toNumber(item.quantity),
            costCenter: item.costCenter || '',
          })),
        };
      }

      case 'kpis': {
        const kpi = this.kpiForm.getRawValue();
        return {
          kpIs: (kpi.kpis || []).map((item: any) => ({
            ...item,
            estimatedDueDate: this.toNullableDate(item.estimatedDueDate),
            actualEndDate: this.toNullableDate(item.actualEndDate),
            targetValue: this.toNullableNumber(item.targetValue),
            currentValue: this.toNullableNumber(item.currentValue),
            estimatedHours: this.toNullableNumber(item.estimatedHours),
            actualHours: this.toNullableNumber(item.actualHours),
            description: item.description || '',
          })),
        };
      }

      default:
        return {};
    }
  }

  // ── FormArray getters ──
  private buildMemberSyncChanges(
    freshMembers: ProjectDto['members'],
    payload: Record<string, unknown>
  ): {
    addedMembers: Array<Record<string, unknown>>;
    removedUserIds: string[];
  } {
    const requestedMembers = Array.isArray(payload['teamMembers'])
      ? payload['teamMembers'] as Array<{ userId?: string; roleId?: string }>
      : [];
    const normalizedFreshMembers = this.normalizedProjectMembers({ ...this.project, members: freshMembers });
    const projectManagerId = this.project.projectManagerId;
    const requestedByUserId = new Map(
      requestedMembers
      .filter((member) => member.userId && member.userId !== projectManagerId)
      .map((member) => {
        const userId = member.userId as string;
        const freshMember = normalizedFreshMembers.find((item) => item.userId === userId);
        return [userId, member.roleId || freshMember?.roleId || this.roleIdForUser(userId)];
      })
    );
    const freshUserIds = new Set(
      normalizedFreshMembers
        .filter((member) => member.userId && member.userId !== projectManagerId)
        .map((member) => member.userId)
    );
    const removedUserIds: string[] = [];
    const addedMembers: Array<Record<string, unknown>> = [];

    freshUserIds.forEach((userId) => {
      if (!requestedByUserId.has(userId)) {
        removedUserIds.push(userId);
      }
    });

    requestedByUserId.forEach((requestedRoleId, userId) => {
      if (!freshUserIds.has(userId)) {
        const memberPayload: Record<string, unknown> = {
          userId,
          UserId: userId,
        };

        if (requestedRoleId) {
          memberPayload['roleId'] = requestedRoleId;
          memberPayload['RoleId'] = requestedRoleId;
        }

        addedMembers.push(memberPayload);
      }
    });

    return { addedMembers, removedUserIds };
  }

  get teamMembers(): FormArray { return this.teamForm.get('teamMembers') as FormArray; }
  get teamInternMembers(): FormArray { return this.teamForm.get('internMembers') as FormArray; }
  get budgetItems(): FormArray { return this.budgetForm.get('budgetItems') as FormArray; }
  get roadblocks(): FormArray { return this.contextForm.get('roadblocks') as FormArray; }
  get kpis(): FormArray { return this.kpiForm.get('kpis') as FormArray; }

  // ── Array CRUD ──
  addTeamMember(): void {
    if (!this.isAdmin) return;
    if (this.memberDraft.invalid) return;
    if (this.isProjectManager(this.memberDraft.get('userId')?.value)) {
      this.notificationService.showWarning('The project manager is managed separately from team members.');
      return;
    }
    this.teamMembers.push(this.fb.group(this.memberDraft.getRawValue()));
    this.memberDraft.reset({ userId: '', role: '', roleId: '' });
  }
  removeTeamMember(i: number): void {
    if (!this.isAdmin) return;

    const userId = String(this.teamMembers.at(i)?.get('userId')?.value || '');
    if (!userId) {
      this.removeTeamMemberLocally(i);
      return;
    }

    const isSavedMember = this.project.members?.some((member) => member.userId === userId);
    if (!isSavedMember) {
      this.removeTeamMemberLocally(i);
      return;
    }

    this.deletingTeamMemberIds.add(userId);
    this.projectService.removeMember(this.project.id, userId).pipe(
      switchMap(() => this.projectService.getProjectMembers(this.project.id)),
      finalize(() => {
        this.deletingTeamMemberIds.delete(userId);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (members) => {
        this.mergeMemberOptions(members);
        this.project = this.normalizeProjectResponse({
          ...this.project,
          members,
        });
        this.syncTeamMembersForm();
        this.notificationService.showSuccess('Team member removed successfully.');
      },
      error: () => {
        this.notificationService.showError('Unable to remove team member.');
      },
    });
  }

  private removeTeamMemberLocally(index: number): void {
    this.teamMembers.removeAt(index);
    this.teamMembers.markAsDirty();
    this.teamForm.markAsDirty();
  }

  addInternMember(): void {
    if (!this.isAdmin) return;

    const internId = this.internMemberDraft.value.trim();
    if (!internId) {
      this.internMemberDraft.markAsTouched();
      return;
    }

    if (this.isInternSelected(internId)) {
      this.notificationService.showWarning('This intern is already added to the project.');
      return;
    }

    const intern = this.interns.find((item) => item.id === internId);
    if (intern) {
      const obj = {
        internId: intern.id,
        id: intern.id,
        fullName: intern.name,
        name: intern.name,
        roleId: intern.roleId,
        roleName: intern.roleName,
        supervisorId: intern.supervisorId,
        supervisorName: intern.supervisorName,
      };
      this.teamInternMembers.push(this.fb.nonNullable.control(JSON.stringify(obj)));
      this.internMemberDraft.reset('');
    }
  }
  removeInternMember(i: number): void {
    if (!this.isAdmin) return;
    this.teamInternMembers.removeAt(i);
  }

  getInternName(controlValue: string): string {
    if (!controlValue) return '';
    try {
      const parsed = JSON.parse(controlValue);
      return parsed.fullName || parsed.name || parsed.raw || controlValue;
    } catch {
      return controlValue;
    }
  }

  getAvailableInterns(): InternDto[] {
    return this.interns.filter((intern) => !this.isInternSelected(intern.id));
  }

  private isInternSelected(internId: string): boolean {
    return this.teamInternMembers.controls.some((control) => {
      try {
        const parsed = JSON.parse(control.value || '{}') as Record<string, unknown>;
        return parsed['internId'] === internId || parsed['id'] === internId;
      } catch {
        return false;
      }
    });
  }

  onProjectManagerChange(pmUserId: string | null): void {
    this.removeProjectManagerFromTeam(pmUserId);
    if (this.isProjectManager(this.memberDraft.get('userId')?.value)) {
      this.memberDraft.reset({ userId: '', role: '', roleId: '' });
    }
  }

  isProjectManager(userId: string | null | undefined): boolean {
    const pmUserId = this.identityForm?.get('projectManagerId')?.value;
    return !!userId && !!pmUserId && userId === pmUserId;
  }

  addBudgetItem(): void {
    if (this.budgetDraft.invalid) return;
    this.budgetItems.push(this.fb.group(this.budgetDraft.getRawValue()));
    this.budgetDraft.reset();
  }
  removeBudgetItem(i: number): void { this.budgetItems.removeAt(i); }

  addRoadblock(): void {
    const val = this.roadblockDraft.value.trim();
    if (val) { this.roadblocks.push(this.fb.control(val)); this.roadblockDraft.reset(); }
  }
  removeRoadblock(i: number): void { this.roadblocks.removeAt(i); }

  addKpi(): void {
    if (this.kpiDraft.invalid) return;
    this.kpis.push(this.fb.group(this.kpiDraft.getRawValue()));
    this.kpiDraft.reset();
  }
  removeKpi(i: number): void { this.kpis.removeAt(i); }



  prettyJson(value: unknown): string {
    return JSON.stringify(this.omitIdFields(value), null, 2);
  }

  getInternMemberLabel(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return this.displayPrimitive(value) || '-';
    }

    const record = value as Record<string, unknown>;
    return (
      this.firstText(record, [
        'internName',
        'InternName',
        'fullName',
        'FullName',
        'userName',
        'UserName',
        'name',
        'Name',
        'raw',
      ]) ||
      this.getDisplayRecordParts(record)[0] ||
      '-'
    );
  }

  getInternMemberMeta(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const record = value as Record<string, unknown>;
    const parts = [
      this.firstText(record, ['roleName', 'RoleName']),
      this.formatHours(record['allocatedHours'] ?? record['AllocatedHours'], 'allocated'),
      this.formatHours(record['hoursWorked'] ?? record['HoursWorked'], 'worked'),
      this.firstText(record, ['supervisorName', 'SupervisorName']),
    ].filter(Boolean);

    return parts.length ? parts.join(' | ') : this.getDisplayRecordParts(record).slice(1).join(' | ');
  }

  isOptionSelected(controlName: string, id: string): boolean {
    const currentValues = this.identityForm.get(controlName)?.value || [];
    return currentValues.includes(id);
  }

  get showParentProjectField(): boolean {
    return this.requiresParentProject(this.identityForm?.get('projectType')?.value);
  }

  get availableParentProjects(): SelectOption[] {
    return this.references.parentProjects.filter((project) => project.id !== this.project?.id);
  }

  parentProjectError(): string {
    if (!this.identityForm?.touched && !this.identityForm?.dirty) {
      return '';
    }

    if (this.identityForm.errors?.['parentProjectRequired']) {
      return 'Parent project is required for this project type.';
    }

    if (this.identityForm.errors?.['parentProjectForbidden']) {
      return 'Parent project is not allowed for this project type.';
    }

    if (this.identityForm.errors?.['parentProjectSelf']) {
      return 'A project cannot be its own parent.';
    }

    return '';
  }

  toggleOption(controlName: string, id: string): void {
    const control = this.identityForm.get(controlName);
    if (!control) return;
    const currentValues = [...(control.value || [])];
    const index = currentValues.indexOf(id);
    if (index > -1) {
      currentValues.splice(index, 1);
    } else {
      currentValues.push(id);
    }
    control.setValue(currentValues);
    control.markAsDirty();
    control.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  private toJsonControls(items: unknown[] | null | undefined): FormControl<string>[] {
    return (items || []).map(item => this.fb.nonNullable.control(JSON.stringify(item)));
  }

  private parseJsonList(items: string[] | null | undefined): unknown[] {
    if (!items?.length) return [];
    return items.map(item => {
      const text = (item || '').trim();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    });
  }

  private toStrategicCriteriaPayload(strategic: Record<string, unknown>): Array<{ type: number; score: number; comment: string }> {
    const criteriaMap: Record<string, number> = {
      financialImpact: 1,
      customerImpact: 2,
      operationalEfficiency: 3,
      strategicAlignment: 4,
      crossFunctionalImpact: 5,
      innovationDigitalisation: 6,
      riskMitigationUrgency: 7,
      sustainabilityESG: 8,
    };

    return Object.entries(criteriaMap).map(([key, type]) => ({
      type,
      score: this.toNumber(strategic[key]),
      comment: '',
    }));
  }

  private toNullableDate(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNumber(value: unknown): number {
    return this.toNullableNumber(value) ?? 0;
  }

  private nullIfEmptyGuid(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim() || value === '00000000-0000-0000-0000-000000000000') {
      return null;
    }

    return value;
  }

  private getProjectKpis(): ProjectDto['KPIs'] {
    return this.project.KPIs ?? this.project.kpIs ?? [];
  }

  // ── Label Helpers ──
  public getStatusLabel(p: ProjectDto): string { return ProjectStatus[p.status] || 'Unknown'; }
  public getPhaseLabel(p: ProjectDto): string { return ProjectPhase[p.phase] || 'Unknown'; }
  public getEnumLabel(val: any, enumObj: any): string { return enumObj[val] || val; }

  public isStatusAllowedForPhase(status: ProjectStatus, phase = this.statusForm?.get('phase')?.value): boolean {
    if (phase === ProjectPhase.Pipeline) {
      return status === ProjectStatus.Planned;
    }

    return true;
  }

  public phaseStatusError(): string {
    if (!this.statusForm?.errors?.['invalidPhaseStatus']) {
      return '';
    }

    return 'Pipeline projects must use the Planned status before they can be saved.';
  }

  public getUserLabel(userId: string): string {
    const user = this.references.users.find(u => u.id === userId);
    return user ? user.label : userId;
  }

  private normalizeProjectResponse(project: ProjectDto): ProjectDto {
    return {
      ...project,
      members: this.normalizedProjectMembers(project),
      internMembers: project.internMembers || [],
      projectResources: project.projectResources || [],
      strategicCriteria: project.strategicCriteria || [],
      businessUnits: project.businessUnits || [],
      technologies: project.technologies || [],
      solutionDomains: project.solutionDomains || [],
      KPIs: project.KPIs || project.kpIs || project.kpis || [],
    };
  }

  private normalizedProjectMembers(project: ProjectDto): ProjectDto['members'] {
    const rawMembers = ((project.members || (project as any).teamMembers || (project as any).TeamMembers || []) as unknown[]);

    return rawMembers
      .map((member) => {
        const record = (member || {}) as Record<string, unknown>;
        const userId = this.firstText(record, ['userId', 'UserId', 'userID', 'id', 'Id']);
        const roleId = this.firstText(record, ['roleId', 'RoleId', 'roleID']);
        const user = this.references.users.find((item) => item.id === userId);
        const roleName = this.firstText(record, ['roleName', 'RoleName', 'role', 'Role', 'name', 'Name']) || this.roleNameForUser(userId, roleId);
        const fullName =
          this.firstText(record, ['fullName', 'FullName', 'userName', 'UserName', 'displayName', 'DisplayName', 'email', 'Email']) ||
          user?.label ||
          userId;

        return {
          ...record,
          userId,
          roleId,
          roleName,
          fullName,
        } as ProjectDto['members'][number];
      })
      .filter((member) => !!member.userId);
  }

  private roleNameForUser(userId: string, roleId = ''): string {
    const user = this.references.users.find((item) => item.id === userId);
    if (user?.roleName) {
      return user.roleName;
    }

    if (roleId) {
      return this.references.roles.find((role) => role.id === roleId)?.label || '';
    }

    return '';
  }

  private firstText(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private omitIdFields(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.omitIdFields(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, child]) => {
      if (!this.isIdKey(key)) {
        acc[key] = this.omitIdFields(child);
      }
      return acc;
    }, {});
  }

  private getDisplayRecordParts(record: Record<string, unknown>): string[] {
    return Object.entries(record)
      .filter(([key, value]) => !this.isIdKey(key) && this.isDisplayPrimitive(value))
      .map(([key, value]) => `${this.humanizeKey(key)}: ${this.displayPrimitive(value)}`)
      .filter((part) => !part.endsWith(': -'));
  }

  private isIdKey(key: string): boolean {
    return key.toLowerCase() === 'id' || key.toLowerCase().endsWith('id');
  }

  private isDisplayPrimitive(value: unknown): value is string | number | boolean {
    return ['string', 'number', 'boolean'].includes(typeof value);
  }

  private displayPrimitive(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'string') {
      return value.trim() || '-';
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return '';
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

  private syncMemberRole(userId: string): void {
    const selectedUser = this.references.users.find((user) => user.id === userId);
    this.memberDraft.get('role')?.setValue(selectedUser?.roleName || '');
    this.memberDraft.get('roleId')?.setValue(selectedUser?.roleId || this.roleIdForUser(userId));
  }

  private roleIdForUser(userId: string): string {
    const selectedUser = this.references.users.find((user) => user.id === userId);
    if (!selectedUser) {
      return '';
    }

    if (selectedUser.roleId) {
      return selectedUser.roleId;
    }

    const roleName = (selectedUser.roleName || '').toLowerCase();
    return this.references.roles.find((role) => role.label.toLowerCase() === roleName)?.id || '';
  }

  private removeProjectManagerFromTeam(pmUserId: string | null): void {
    if (!pmUserId || !this.teamForm) {
      return;
    }

    for (let index = this.teamMembers.length - 1; index >= 0; index--) {
      if (this.teamMembers.at(index).get('userId')?.value === pmUserId) {
        this.teamMembers.removeAt(index);
        this.teamMembers.markAsDirty();
      }
    }
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  switchToEdit(): void {
    if (!this.isAdmin) return;
    this.router.navigate(['/projects', this.project.id, 'edit']);
  }

  public openProjectAllocations(): void {
    this.router.navigate(['/projects', this.project.id, 'allocations']);
  }

  backToList(): void {
    this.router.navigate([this.projectsBasePath()]);
  }

  backToDetails(): void {
    this.router.navigate(['/projects', this.project.id]);
  }

  private projectsBasePath(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.includes('/admin/projects') ? '/admin/projects' : '/projects';
  }

  private updateIdentityDynamicValidators(): void {
    if (!this.identityForm) {
      return;
    }

    const parentControl = this.identityForm.get('parentProjectId');
    if (!parentControl) {
      return;
    }

    if (this.showParentProjectField) {
      parentControl.setValidators(Validators.required);
    } else {
      parentControl.clearValidators();
      if (parentControl.value) {
        parentControl.setValue(null, { emitEvent: false });
      }
    }

    parentControl.updateValueAndValidity({ emitEvent: false });
    this.identityForm.updateValueAndValidity({ emitEvent: false });
  }

  private identityValidator = (group: AbstractControl): { parentProjectRequired?: true; parentProjectForbidden?: true; parentProjectSelf?: true } | null => {
    const projectType = group.get('projectType')?.value as ProjectType | null;
    const parentProjectId = this.nullIfEmptyGuid(group.get('parentProjectId')?.value);
    const errors: { parentProjectRequired?: true; parentProjectForbidden?: true; parentProjectSelf?: true } = {};

    if (this.requiresParentProject(projectType)) {
      if (!parentProjectId) {
        errors.parentProjectRequired = true;
      } else if (parentProjectId === this.project?.id) {
        errors.parentProjectSelf = true;
      }
    } else if (parentProjectId) {
      errors.parentProjectForbidden = true;
    }

    return Object.keys(errors).length ? errors : null;
  };

  private requiresParentProject(projectType: unknown): boolean {
    return (
      projectType === ProjectType.NewPhase ||
      projectType === ProjectType.Extension ||
      projectType === ProjectType.Sustain
    );
  }

  private phaseStatusValidator(group: AbstractControl): { invalidPhaseStatus: true } | null {
    const phase = group.get('phase')?.value as ProjectPhase | null;
    const status = group.get('status')?.value as ProjectStatus | null;

    if (phase === ProjectPhase.Pipeline && status !== null && status !== ProjectStatus.Planned) {
      return { invalidPhaseStatus: true };
    }

    return null;
  }

  private dateValidator(group: AbstractControl): { endDateInvalid?: true; estimatedDateInvalid?: true } | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    const estimated = group.get('estimatedDueDate')?.value;
    const errors: { endDateInvalid?: true; estimatedDateInvalid?: true } = {};

    if (start && end && new Date(end) <= new Date(start)) {
      errors.endDateInvalid = true;
    }

    if (start && estimated && new Date(estimated) <= new Date(start)) {
      errors.estimatedDateInvalid = true;
    }

    return Object.keys(errors).length ? errors : null;
  }

  // ── File and Allocation Methods ──
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

  private loadProjectMembers(projectId: string): void {
    this.projectService.getProjectMembers(projectId).pipe(
      catchError(() => of([] as ProjectDto['members']))
    ).subscribe((members) => {
      this.mergeMemberOptions(members);
      this.project = this.normalizeProjectResponse({
        ...this.project,
        members,
      });
      this.syncTeamMembersForm();
      this.cdr.detectChanges();
    });
  }

  private mergeMemberOptions(members: ProjectDto['members']): void {
    const usersById = new Map(this.references.users.map((user) => [user.id, user]));
    members.forEach((member) => {
      if (!member.userId || usersById.has(member.userId)) {
        return;
      }

      usersById.set(member.userId, {
        id: member.userId,
        label: member.fullName || member.email || member.userId,
        email: member.email || '',
        roleId: member.roleId || '',
        roleName: member.roleName || '',
      });
    });

    this.references = {
      ...this.references,
      users: Array.from(usersById.values()),
    };
  }

  private syncTeamMembersForm(): void {
    if (!this.teamForm) {
      return;
    }

    this.teamForm.setControl(
      'teamMembers',
      this.fb.array(
        this.normalizedProjectMembers(this.project)
          .filter((member) => member.userId !== this.project.projectManagerId)
          .map((member) => this.fb.group({
            userId: [member.userId, Validators.required],
            role: [member.roleName || this.roleNameForUser(member.userId, member.roleId), Validators.required],
            roleId: [member.roleId || ''],
          }))
      )
    );
  }

  private loadInterns(): void {
    this.isLoadingInterns = true;
    this.internService
      .getInterns()
      .pipe(
        catchError(() => {
          this.notificationService.showWarning('Unable to load interns.');
          return of([] as InternDto[]);
        }),
        finalize(() => {
          this.isLoadingInterns = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((interns) => {
        this.interns = interns;
      });
  }

  private loadProjectAllocations(): void {
    const projectId = this.project?.id;
    if (!projectId) {
      return;
    }

    const params: Omit<HoursAllocationDashboardParams, 'projectId'> = {
      analysis: 'projectUsers',
      search: this.allocationSearch.trim() || null,
      all: true,
    };

    this.isLoadingAllocations = true;
    this.allocationLoadError = '';

    const request$: Observable<HoursAllocationDashboardDto | HourEntryDto[] | null> = this.authService.isAdmin()
      ? this.hoursAllocationDashboard
          .getProjectDashboard(projectId, params)
          .pipe(
            catchError(() => {
              this.allocationLoadError = 'Unable to load project allocations.';
              return of(null);
            })
          )
      : this.hourEntriesApi
          .getMyByProject(projectId)
          .pipe(
            catchError(() => {
              this.allocationLoadError = 'Unable to load your project allocations.';
              return of(null);
            })
          );

    request$
      .pipe(
        finalize(() => {
          this.isLoadingAllocations = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((result) => {
        this.projectAllocations = Array.isArray(result)
          ? this.toMyProjectAllocationRows(result, projectId)
          : result?.hoursByProjectUser ?? [];
      });
  }

  private toMyProjectAllocationRows(entries: HourEntryDto[], projectId: string): HoursAllocationByProjectUserDto[] {
    const query = this.allocationSearch.trim().toLowerCase();
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
      totalHours: this.sumHourEntries(entries, 'totalHours'),
      executionHours: this.sumHourEntries(entries, 'executionHours'),
      techLeadHours: this.sumHourEntries(entries, 'supervisionHours'),
      processHours: this.sumHourEntries(entries, 'processHours'),
      projectManagementHours: this.sumHourEntries(entries, 'managementHours'),
      researchAndDevHours: this.sumHourEntries(entries, 'rAndDHours'),
      workshopHours: this.sumHourEntries(entries, 'workshopHours'),
      otherHours: this.sumHourEntries(entries, 'otherHours') + this.sumHourEntries(entries, 'internManagementHours'),
      workedDays: new Set(entries.map((entry) => entry.date).filter(Boolean)).size,
      allocationCount: entries.length,
      isProjectManager: false,
    }];
  }

  private sumHourEntries(entries: HourEntryDto[], key: keyof HourEntryDto): number {
    return entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
  }

  private normalizeFileTypeLabel(file: ProjectFileDto): string {
    const label = (file.fileTypeLabel || '').trim();
    if (label) {
      return label.toLowerCase();
    }

    const enumLabel = this.requiredProjectFileTypes.find((type) => type.value === file.fileType)?.label || '';
    return enumLabel.toLowerCase();
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

    const fileTypeLabel =
      this.requiredProjectFileTypes.find((type) => type.value === fileType)?.label || 'document';
    this.pendingProjectFileUpload = { file, fileType, fileTypeLabel };
    this.pendingProjectVersionUpload = null;
    this.projectFileMessageDraft = '';
    input.value = '';
  }

  confirmProjectFileMessage(): void {
    if (this.pendingProjectVersionUpload) {
      this.confirmProjectVersionUpload();
      return;
    }

    this.confirmProjectFileUpload();
  }

  confirmProjectFileUpload(): void {
    if (!this.isAdmin) return;
    const pending = this.pendingProjectFileUpload;
    if (!pending || !this.project?.id) return;

    this.isUploading[pending.fileType] = true;

    this.fileService.upload(this.project.id, {
      file: pending.file,
      fileType: pending.fileType,
      description: this.projectFileMessageDraft.trim() || null
    }).subscribe({
      next: () => {
        this.isUploading[pending.fileType] = false;
        this.clearProjectFileMessage();
        this.notificationService.showSuccess('File uploaded successfully.');
        if (this.project?.id) {
          this.loadProjectFiles(this.project.id);
        }
      },
      error: () => {
        this.isUploading[pending.fileType] = false;
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

    this.pendingProjectVersionUpload = { file: newFile, currentFile: file };
    this.pendingProjectFileUpload = null;
    this.projectFileMessageDraft = '';
    input.value = '';
  }

  confirmProjectVersionUpload(): void {
    if (!this.isAdmin) return;
    const pending = this.pendingProjectVersionUpload;
    if (!pending || !this.project?.id) return;

    this.isUploadingVersion[pending.currentFile.id] = true;

    this.fileService.uploadVersion(this.project.id, pending.currentFile.id, {
      file: pending.file,
      description: this.projectFileMessageDraft.trim() || null
    }).subscribe({
      next: () => {
        this.isUploadingVersion[pending.currentFile.id] = false;
        this.clearProjectFileMessage();
        this.notificationService.showSuccess('New version uploaded successfully.');
        if (this.project?.id) {
          this.loadProjectFiles(this.project.id);
        }
        if (this.expandedHistoryFileId === pending.currentFile.id) {
          this.loadVersions(pending.currentFile.id);
        }
      },
      error: () => {
        this.isUploadingVersion[pending.currentFile.id] = false;
        this.notificationService.showError("Unable to upload the new version.");
      }
    });
  }

  clearProjectFileMessage(): void {
    this.pendingProjectFileUpload = null;
    this.pendingProjectVersionUpload = null;
    this.projectFileMessageDraft = '';
  }

  getPendingProjectFileName(): string {
    return this.pendingProjectVersionUpload?.file.name
      || this.pendingProjectFileUpload?.file.name
      || '';
  }

  getPendingProjectFileTarget(): string {
    if (this.pendingProjectVersionUpload) {
      return this.pendingProjectVersionUpload.currentFile.originalFileName || 'existing document';
    }

    return this.pendingProjectFileUpload?.fileTypeLabel || 'document';
  }

  isConfirmingProjectFileMessage(): boolean {
    if (this.pendingProjectVersionUpload) {
      return !!this.isUploadingVersion[this.pendingProjectVersionUpload.currentFile.id];
    }

    if (this.pendingProjectFileUpload) {
      return !!this.isUploading[this.pendingProjectFileUpload.fileType];
    }

    return false;
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
}
