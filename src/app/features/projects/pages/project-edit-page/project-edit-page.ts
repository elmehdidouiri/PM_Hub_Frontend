import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
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

  readonly phaseOptions = Object.values(ProjectPhase).filter((v) => typeof v === 'number');
  readonly statusOptions = Object.values(ProjectStatus).filter((v) => typeof v === 'number');
  readonly processStatusOptions = Object.values(ProcessStatus).filter((v) => typeof v === 'number');

  constructor(
    private readonly fb: FormBuilder,
    private readonly projectService: ProjectService,
    private readonly referenceService: ProjectReferenceService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.memberDraft = this.fb.group({
      userId: this.fb.nonNullable.control('', Validators.required),
      role: this.fb.nonNullable.control('', Validators.required),
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
    this.project = this.route.snapshot.data['project'];
    const refs = this.route.snapshot.data['refs'];
    if (refs) {
      this.references = refs;
    }
    this.initForms();
    this.loadDeliverables();
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

    // ── Execution State (Status & Phase) ──
    this.statusForm = this.fb.group({
      status: [this.project.status, Validators.required],
      phase: [this.project.phase, Validators.required],
      processStatus: [this.project.processStatus],
      progressPercentage: [this.project.progressPercentage || 0, [Validators.min(0), Validators.max(100)]]
    });

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
      teamMembers: this.fb.array((this.project.members || []).map(m => this.fb.group({
        userId: [m.userId, Validators.required],
        role: [m.roleName, Validators.required]
      })))
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

    this.collectionsForm = this.fb.group({
      internMembers: this.fb.array(this.toJsonControls(this.project.internMembers)),
      subProjects: this.fb.array(this.toJsonControls(this.project.subProjects)),
      deliverables: this.fb.array(this.toJsonControls(this.project.deliverables)),
      timelineEntries: this.fb.array(this.toJsonControls(this.project.timelineEntries)),
      roadblockEntries: this.fb.array(this.toJsonControls(this.project.roadblockEntries)),
    });

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
    const collections = this.collectionsForm.getRawValue();

    return {
      ...identity,
      ...status,
      ...timeline,
      ...financial,
      ...context,
      strategicCriteria: strategic,
      teamMembers: team.teamMembers,
      budgetItems: budget.budgetItems,
      kpIs: kpi.kpis,
      internMembers: this.parseJsonList(collections.internMembers),
      subProjects: this.parseJsonList(collections.subProjects),
      deliverables: this.parseJsonList(collections.deliverables),
      timelineEntries: this.parseJsonList(collections.timelineEntries),
      roadblockEntries: this.parseJsonList(collections.roadblockEntries),
      roadblocks: context.roadblocks?.join(', ') || ''
    };
  }

  // ── FormArray getters ──
  get teamMembers(): FormArray { return this.teamForm.get('teamMembers') as FormArray; }
  get budgetItems(): FormArray { return this.budgetForm.get('budgetItems') as FormArray; }
  get roadblocks(): FormArray { return this.contextForm.get('roadblocks') as FormArray; }
  get kpis(): FormArray { return this.kpiForm.get('kpis') as FormArray; }
  get collectionInternMembers(): FormArray { return this.collectionsForm.get('internMembers') as FormArray; }
  get collectionSubProjects(): FormArray { return this.collectionsForm.get('subProjects') as FormArray; }
  get collectionDeliverables(): FormArray { return this.collectionsForm.get('deliverables') as FormArray; }
  get collectionTimelineEntries(): FormArray { return this.collectionsForm.get('timelineEntries') as FormArray; }
  get collectionRoadblockEntries(): FormArray { return this.collectionsForm.get('roadblockEntries') as FormArray; }

  // ── Array CRUD ──
  addTeamMember(): void {
    if (this.memberDraft.invalid) return;
    this.teamMembers.push(this.fb.group(this.memberDraft.getRawValue()));
    this.memberDraft.reset();
  }
  removeTeamMember(i: number): void { this.teamMembers.removeAt(i); }

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

  addCollectionItem(key: 'internMembers' | 'subProjects' | 'deliverables' | 'timelineEntries' | 'roadblockEntries'): void {
    this.getCollectionByKey(key).push(this.fb.control('{}'));
  }

  removeCollectionItem(key: 'internMembers' | 'subProjects' | 'deliverables' | 'timelineEntries' | 'roadblockEntries', i: number): void {
    this.getCollectionByKey(key).removeAt(i);
  }

  getCollectionByKey(key: 'internMembers' | 'subProjects' | 'deliverables' | 'timelineEntries' | 'roadblockEntries'): FormArray {
    const map = {
      internMembers: this.collectionInternMembers,
      subProjects: this.collectionSubProjects,
      deliverables: this.collectionDeliverables,
      timelineEntries: this.collectionTimelineEntries,
      roadblockEntries: this.collectionRoadblockEntries,
    };
    return map[key];
  }

  prettyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
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

  public getUserLabel(userId: string): string {
    const user = this.references.users.find(u => u.id === userId);
    return user ? user.label : userId;
  }

  backToDetails(): void {
    this.router.navigate(['/projects', this.project.id]);
  }
}
