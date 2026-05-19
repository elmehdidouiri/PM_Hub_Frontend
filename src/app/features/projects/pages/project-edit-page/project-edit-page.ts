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
    });
    this.identityForm.controls['projectManagerId'].valueChanges.subscribe((pmUserId) => this.onProjectManagerChange(pmUserId));

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
      estimatedHours: [this.project.estimatedHours],
      actualHours: [this.project.actualHours],
    });

    // ── Financial ──
    this.financialForm = this.fb.group({
      budget: [this.project.budget],
      costSaving: [this.project.costSaving],
      digitalContribution: [this.project.digitalContribution],
    });

    // ── Strategic Criteria (all 8 from StrategicCriteriaDto) ──
    const sc = this.project.strategicCriteria || [];
    this.strategicForm = this.fb.group({
      financialImpact: [this.getStrategicScore(sc, 1)],
      customerImpact: [this.getStrategicScore(sc, 2)],
      operationalEfficiency: [this.getStrategicScore(sc, 3)],
      strategicAlignment: [this.getStrategicScore(sc, 4)],
      crossFunctionalImpact: [this.getStrategicScore(sc, 5)],
      innovationDigitalisation: [this.getStrategicScore(sc, 6)],
      riskMitigationUrgency: [this.getStrategicScore(sc, 7)],
      sustainabilityESG: [this.getStrategicScore(sc, 8)],
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
      teamMembers: this.fb.array((this.project.members || []).filter((m) => m.userId !== this.project.projectManagerId).map(m => this.fb.group({
        userId: [m.userId, Validators.required],
        role: [m.roleName, Validators.required],
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
      }
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();
    const payload = this.buildUpdatePayload();
    this.projectService.updateProject(this.project.id, payload).subscribe({
      next: (updated) => this.handleSaveSuccess(updated),
      error: () => this.handleSaveError()
    });
  }

  private handleSaveSuccess(updatedProject: ProjectDto): void {
    this.project = updatedProject;
    this.isSaving = false;
    this.editingSection = null;
    this.notificationService.showSuccess('Project updated successfully.');
    this.initForms();
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

  private buildUpdatePayload(): any {
    const identity = this.identityForm.getRawValue();
    const status = this.statusForm.getRawValue();
    const timeline = this.timelineForm.getRawValue();
    const financial = this.financialForm.getRawValue();
    const strategic = this.strategicForm.getRawValue();
    const context = this.contextForm.getRawValue();
    const team = this.teamForm.getRawValue();
    const budget = this.budgetForm.getRawValue();
    const kpi = this.kpiForm.getRawValue();

    return {
      ...identity,
      ...status,
      ...timeline,
      ...financial,
      ...context,
      strategicCriteria: strategic,
      teamMembers: (team.teamMembers || []).filter((member: { userId?: string }) => member.userId !== identity.projectManagerId),
      budgetItems: budget.budgetItems,
      kpIs: kpi.kpis,
      internMembers: this.parseJsonList(team.internMembers),
      subProjects: this.project.subProjects || [],
      deliverables: this.project.deliverables || [],
      timelineEntries: this.project.timelineEntries || [],
      roadblockEntries: this.project.roadblockEntries || [],
      roadblocks: context.roadblocks?.join(', ') || ''
    };
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

  private phaseStatusValidator(group: AbstractControl): { invalidPhaseStatus: true } | null {
    const phase = group.get('phase')?.value as ProjectPhase | null;
    const status = group.get('status')?.value as ProjectStatus | null;

    if (phase === ProjectPhase.Pipeline && status !== null && status !== ProjectStatus.Planned) {
      return { invalidPhaseStatus: true };
    }

    return null;
  }
}
