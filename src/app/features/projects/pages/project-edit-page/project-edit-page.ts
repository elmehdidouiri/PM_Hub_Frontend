import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth';
import {
  ProjectDto,
  ProcessStatus,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectReferenceData,
  ProjectStatus,
  SelectOption,
} from '../../models';
import { ProjectReferenceService } from '../../services/project-reference.service';
import { ProjectService } from '../../services/project';

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

  // Deliverables (loaded separately via API)
  deliverables: any[] = [];
  readonly collectionKeys = ['internMembers', 'subProjects', 'deliverables', 'timelineEntries', 'roadblockEntries'] as const;

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly projectService: ProjectService,
    private readonly referenceService: ProjectReferenceService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: AuthService
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
    this.route.data.subscribe(data => {
      this.mode = data['mode'] || 'details';
    });
    this.project = this.route.snapshot.data['project'];
    const refs = this.route.snapshot.data['refs'];
    if (refs) {
      this.references = refs;
    }
    this.initForms();
    this.loadDeliverables();
    this.memberDraft.controls['userId'].valueChanges.subscribe((userId) => this.syncMemberRole(userId));
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
    this.identityForm.controls['projectManagerId'].valueChanges.subscribe((pmUserId) => this.onProjectManagerChange(pmUserId));
    this.identityForm.controls['projectType'].valueChanges.subscribe(() => this.updateIdentityDynamicValidators());
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
  loadDeliverables(): void {
    this.projectService.getDeliverables(this.project.id).subscribe({
      next: (data) => { this.deliverables = data as any[]; },
      error: () => { this.deliverables = []; }
    });
  }

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
    this.editingSection = (this.editingSection === section) ? null : section;
  }

  cancelEdit(): void {
    this.editingSection = null;
    this.initForms();
  }

  saveSection(section: string): void {
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

    this.isSaving = true;
    const payload = this.buildUpdatePayload(section);
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
  get teamMembers(): FormArray { return this.teamForm.get('teamMembers') as FormArray; }
  get teamInternMembers(): FormArray { return this.teamForm.get('internMembers') as FormArray; }
  get budgetItems(): FormArray { return this.budgetForm.get('budgetItems') as FormArray; }
  get roadblocks(): FormArray { return this.contextForm.get('roadblocks') as FormArray; }
  get kpis(): FormArray { return this.kpiForm.get('kpis') as FormArray; }

  // ── Array CRUD ──
  addTeamMember(): void {
    if (this.memberDraft.invalid) return;
    if (this.isProjectManager(this.memberDraft.get('userId')?.value)) {
      this.notificationService.showWarning('The project manager is managed separately from team members.');
      return;
    }
    this.teamMembers.push(this.fb.group(this.memberDraft.getRawValue()));
    this.memberDraft.reset({ userId: '', role: '', roleId: '' });
  }
  removeTeamMember(i: number): void { this.teamMembers.removeAt(i); }

  addInternMember(): void {
    const val = this.internMemberDraft.value.trim();
    if (val) {
      const obj = { fullName: val };
      this.teamInternMembers.push(this.fb.control(JSON.stringify(obj)));
      this.internMemberDraft.reset();
    }
  }
  removeInternMember(i: number): void {
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
    return JSON.stringify(value, null, 2);
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
}
