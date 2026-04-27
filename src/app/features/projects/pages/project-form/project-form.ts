import { Component, HostListener, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  CreateProjectDto,
  ProcessStatus,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectReferenceData,
  ProjectStatus,
  SelectOption,
  ProjectFileType,
  UploadProjectFile,
} from '../../models';
import { ProjectReferenceService } from '../../services/project-reference.service';
import { ProjectService } from '../../services/project';

@Component({
  selector: 'app-project-form',
  standalone: false,
  templateUrl: './project-form.html',
  styleUrls: ['./project-form.scss'],
})
export class ProjectForm implements OnInit {
  protected readonly ProcessStatus = ProcessStatus;
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly ProjectStatus = ProjectStatus;
  isSubmitting = false;
  stepperOrientation: 'horizontal' | 'vertical' = 'horizontal';
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
  projectManagers: SelectOption[] = [];

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

  readonly memberDraft: FormGroup;
  readonly budgetDraft: FormGroup;
  readonly roadblockDraft: FormControl<string>;
  readonly businessUnitDraft: FormControl<string>;
  readonly wizardForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly projectService: ProjectService,
    private readonly referenceService: ProjectReferenceService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.memberDraft = this.fb.group({
      userId: this.fb.nonNullable.control('', Validators.required),
      role: this.fb.nonNullable.control('', Validators.required),
    });

    this.budgetDraft = this.fb.group({
      itemName: this.fb.nonNullable.control('', Validators.required),
      pricePerUnit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    });

    this.roadblockDraft = this.fb.nonNullable.control('');
    this.businessUnitDraft = this.fb.nonNullable.control('');

    this.wizardForm = this.fb.group({
      step1: this.fb.group({
        projectManagementType: this.fb.nonNullable.control(ProjectManagementType.DigitalOperation, Validators.required),
        projectType: this.fb.nonNullable.control(ProjectType.NewProject, Validators.required),
        parentProjectId: this.fb.control<string | null>(null),
        processStatus: this.fb.control<ProcessStatus | null>(null),
      }),
      step2: this.fb.group({
        name: this.fb.nonNullable.control('', Validators.required),
        phase: this.fb.control<ProjectPhase | null>(null, Validators.required),
        status: this.fb.control<ProjectStatus | null>(null, Validators.required),
        description: this.fb.nonNullable.control(''),
      }),
      step3: this.fb.group({
        projectManagerId: this.fb.control<string | null>(null),
        sponsor: this.fb.nonNullable.control(''),
        businessUnitIds: this.fb.nonNullable.control<string[]>([], Validators.minLength(1)),
        plantName: this.fb.nonNullable.control(''),
        departmentId: this.fb.nonNullable.control('', Validators.required),
        costSaving: this.fb.control<number | null>(null, Validators.min(0)),
      }),
      step4: this.fb.group({
        technologyIds: this.fb.nonNullable.control<string[]>([]),
        solutionDomainIds: this.fb.nonNullable.control<string[]>([]),
      }),
      step5: this.fb.group({
        startDate: this.fb.nonNullable.control('', Validators.required),
        endDate: this.fb.nonNullable.control(''),
        estimatedDueDate: this.fb.nonNullable.control(''),
        estimatedHours: this.fb.control<number | null>(null, Validators.min(0)),
        actualHours: this.fb.control<number | null>(null, Validators.min(0)),
      }),
      step6: this.fb.group({
        financialImpact: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        customerImpact: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        operationalEfficiency: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        strategicAlignment: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        crossFunctionalImpact: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        innovationDigitalisation: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        riskMitigationUrgency: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
        sustainabilityESG: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(10)]),
      }),
      step7: this.fb.group({
        teamMembers: this.fb.array<FormGroup>([]),
      }),
      step8: this.fb.group({
        budgetItems: this.fb.array<FormGroup>([], Validators.minLength(1)),
      }),
      step9: this.fb.group({
        currentState: this.fb.nonNullable.control(''),
        nextSteps: this.fb.nonNullable.control(''),
        enhancements: this.fb.nonNullable.control(''),
        roadblocks: this.fb.array<FormControl<string>>([]),
      }),
      step10: this.fb.group({
        files: this.fb.array([]),
      }),
    }, { validators: this.dateValidator });

    this.projectFiles = [];
  }

  dateValidator(group: AbstractControl): { [key: string]: any } | null {
    const step5 = (group as FormGroup).get('step5');
    if (!step5) return null;
    
    const start = step5.get('startDate')?.value;
    const end = step5.get('endDate')?.value;
    const estimated = step5.get('estimatedDueDate')?.value;

    const errors: any = {};
    let hasError = false;

    if (start && end && new Date(end) < new Date(start)) {
      errors['endDateInvalid'] = true;
      hasError = true;
    }
    
    if (start && estimated && new Date(estimated) < new Date(start)) {
      errors['estimatedDateInvalid'] = true;
      hasError = true;
    }

    return hasError ? errors : null;
  }

  projectFiles: UploadProjectFile[] = [];
  readonly projectFileTypeOptions = [
    { value: ProjectFileType.BRD, label: 'Business Requirements (BRD)' },
    { value: ProjectFileType.FDD, label: 'Functional Design (FDD)' },
    { value: ProjectFileType.PROCESS, label: 'Process Flow' },
    { value: ProjectFileType.UAT, label: 'User Acceptance (UAT)' },
    { value: ProjectFileType.RiskAssessment, label: 'Risk Assessment' },
    { value: ProjectFileType.Timeline, label: 'Project Timeline' },
    { value: ProjectFileType.StrategicEvaluation, label: 'Strategic Evaluation' },
    { value: ProjectFileType.OnePager, label: 'One Pager' },
    { value: ProjectFileType.SharePoint, label: 'SharePoint Link / Doc' },
    { value: ProjectFileType.SAPApproval, label: 'SAP Approval' },
    { value: ProjectFileType.Compliance, label: 'Compliance' },
  ];

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.projectFiles.push({
          file: file,
          fileType: ProjectFileType.BRD,
          fileName: file.name
        });
      }
    }
  }

  removeFile(index: number): void {
    this.projectFiles.splice(index, 1);
  }

  ngOnInit(): void {
    this.updateStepperOrientation();
    this.loadReferences();
    this.updateDynamicValidators();
    this.step1Group.controls['projectManagementType'].valueChanges.subscribe(() => this.updateDynamicValidators());
    this.step1Group.controls['projectType'].valueChanges.subscribe(() => this.updateDynamicValidators());
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateStepperOrientation();
  }

  get step1Group(): FormGroup {
    return this.wizardForm.controls['step1'] as FormGroup;
  }
  get step2Group(): FormGroup {
    return this.wizardForm.controls['step2'] as FormGroup;
  }
  get step3Group(): FormGroup {
    return this.wizardForm.controls['step3'] as FormGroup;
  }
  get step4Group(): FormGroup {
    return this.wizardForm.controls['step4'] as FormGroup;
  }
  get step5Group(): FormGroup {
    return this.wizardForm.controls['step5'] as FormGroup;
  }
  get step6Group(): FormGroup {
    return this.wizardForm.controls['step6'] as FormGroup;
  }
  get step7Group(): FormGroup {
    return this.wizardForm.controls['step7'] as FormGroup;
  }
  get step8Group(): FormGroup {
    return this.wizardForm.controls['step8'] as FormGroup;
  }
  get step9Group(): FormGroup {
    return this.wizardForm.controls['step9'] as FormGroup;
  }
  get step10Group(): FormGroup {
    return this.wizardForm.controls['step10'] as FormGroup;
  }

  get teamMembers(): FormArray<FormGroup> {
    return this.step7Group.controls['teamMembers'] as FormArray<FormGroup>;
  }

  get budgetItems(): FormArray<FormGroup> {
    return this.step8Group.controls['budgetItems'] as FormArray<FormGroup>;
  }

  get roadblocks(): FormArray<FormControl<string>> {
    return this.step9Group.controls['roadblocks'] as FormArray<FormControl<string>>;
  }

  get showParentProject(): boolean {
    const value = this.step1Group.controls['projectType'].value as ProjectType;
    return value === ProjectType.NewPhase || value === ProjectType.Extension || value === ProjectType.Sustain;
  }

  get showProcessStatus(): boolean {
    return (this.step1Group.controls['projectType'].value as ProjectType) === ProjectType.NewProcessProject;
  }

  get selectedBusinessUnits(): SelectOption[] {
    const ids = this.step3Group.controls['businessUnitIds'].value ?? [];
    const selected = new Set(ids);
    return this.references.businessUnits.filter((unit) => selected.has(unit.id));
  }

  addTeamMember(): void {
    if (this.memberDraft.invalid) {
      this.memberDraft.markAllAsTouched();
      return;
    }
    this.teamMembers.push(this.fb.group(this.memberDraft.getRawValue()));
    this.memberDraft.reset({ userId: '', role: '' });
  }

  removeTeamMember(index: number): void {
    this.teamMembers.removeAt(index);
  }

  addBudgetItem(): void {
    if (this.budgetDraft.invalid) {
      this.budgetDraft.markAllAsTouched();
      return;
    }
    this.budgetItems.push(this.fb.group(this.budgetDraft.getRawValue()));
    this.budgetDraft.reset({ itemName: '', pricePerUnit: null, quantity: null });
  }

  removeBudgetItem(index: number): void {
    this.budgetItems.removeAt(index);
  }

  addBusinessUnit(): void {
    const selectedId = this.businessUnitDraft.value;
    if (!selectedId) {
      return;
    }

    const current = this.step3Group.controls['businessUnitIds'].value ?? [];
    if (!current.includes(selectedId)) {
      this.step3Group.controls['businessUnitIds'].setValue([...current, selectedId]);
      this.step3Group.controls['businessUnitIds'].markAsDirty();
      this.step3Group.controls['businessUnitIds'].updateValueAndValidity();
    }

    this.businessUnitDraft.setValue('');
  }

  removeBusinessUnit(id: string): void {
    const current = this.step3Group.controls['businessUnitIds'].value ?? [];
    const next = current.filter((item: string) => item !== id);
    this.step3Group.controls['businessUnitIds'].setValue(next);
    this.step3Group.controls['businessUnitIds'].markAsDirty();
    this.step3Group.controls['businessUnitIds'].updateValueAndValidity();
  }

  addRoadblock(): void {
    const value = this.roadblockDraft.value.trim();
    if (!value) return;
    this.roadblocks.push(this.fb.nonNullable.control(value));
    this.roadblockDraft.reset('');
  }

  removeRoadblock(index: number): void {
    this.roadblocks.removeAt(index);
  }

  submitProject(): void {
    if (this.wizardForm.invalid) {
      this.wizardForm.markAllAsTouched();
      if (this.wizardForm.errors?.['endDateInvalid']) {
        this.notificationService.showWarning('Project end date must be after the start date.');
      } else if (this.wizardForm.errors?.['estimatedDateInvalid']) {
        this.notificationService.showWarning('Estimated due date must be after the start date.');
      } else {
        this.notificationService.showWarning('Please complete all required fields before submitting.');
      }
      return;
    }

    // Fix for NG0100 error: change state in next tick
    setTimeout(() => {
      this.isSubmitting = true;
    });

    const payload = this.buildCreatePayload();
    
    this.projectService.createProject(payload).subscribe({
      next: (project) => {
        // Upload files if any
        if (this.projectFiles.length > 0) {
          const uploadTasks = this.projectFiles.map(fileData => 
            this.projectService.uploadProjectFile(project.id, fileData).pipe(
              catchError(err => {
                console.error('File upload failed:', err);
                return of(null);
              })
            )
          );

          forkJoin(uploadTasks).subscribe(() => {
            this.isSubmitting = false;
            this.notificationService.showSuccess('Project created and files uploaded successfully.');
            this.router.navigate(['/admin/projects', project.id]);
          });
        } else {
          this.isSubmitting = false;
          this.notificationService.showSuccess('Project created successfully.');
          this.router.navigate(['/admin/projects', project.id]);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.notificationService.showError((error as { message?: string })?.message ?? 'Unable to create project.');
      },
    });
  }

  enumLabel(value: number, enumRef: object): string {
    return String((enumRef as Record<number, string>)[value] ?? value);
  }

  isInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildCreatePayload(): any {
    const step1 = this.step1Group.getRawValue();
    const step2 = this.step2Group.getRawValue();
    const step3 = this.step3Group.getRawValue();
    const step4 = this.step4Group.getRawValue();
    const step5 = this.step5Group.getRawValue();
    const step6 = this.step6Group.getRawValue();
    const step10 = this.step10Group.getRawValue();

    return {
      projectManagementType: step1.projectManagementType as ProjectManagementType,
      projectType: Number(step1.projectType) as ProjectType,
      name: step2.name.trim(),
      phase: step2.phase as ProjectPhase,
      status: step2.status as ProjectStatus,
      description: this.emptyToNull(step2.description),
      projectManagerId: step3.projectManagerId || null,
      sponsor: this.emptyToNull(step3.sponsor),
      businessUnitIds: step3.businessUnitIds ?? [],
      plantName: this.emptyToNull(step3.plantName),
      departmentId: step3.departmentId,
      costSaving: this.numberOrNull(step3.costSaving),
      technologyIds: step4.technologyIds ?? [],
      solutionDomainIds: step4.solutionDomainIds ?? [],
      startDate: this.toApiDate(step5.startDate)!,
      endDate: this.toApiDate(step5.endDate),
      estimatedDueDate: this.toApiDate(step5.estimatedDueDate),
      estimatedHours: this.numberOrNull(step5.estimatedHours),
      actualHours: this.numberOrNull(step5.actualHours),
      strategicCriteria: {
        financialImpact: this.numberOrNull(step6.financialImpact),
        customerImpact: this.numberOrNull(step6.customerImpact),
        operationalEfficiency: this.numberOrNull(step6.operationalEfficiency),
        strategicAlignment: this.numberOrNull(step6.strategicAlignment),
        crossFunctionalImpact: this.numberOrNull(step6.crossFunctionalImpact),
        innovationDigitalisation: this.numberOrNull(step6.innovationDigitalisation),
        riskMitigationUrgency: this.numberOrNull(step6.riskMitigationUrgency),
        sustainabilityESG: this.numberOrNull(step6.sustainabilityESG),
      },
      teamMembers: this.teamMembers.getRawValue().map((item) => ({
        userId: String(item['userId']),
        role: String(item['role']).trim(),
      })),
      budgetItems: this.budgetItems.getRawValue().map((item) => ({
        itemName: String(item['itemName']).trim(),
        pricePerUnit: Number(item['pricePerUnit']),
        quantity: Number(item['quantity']),
      })),
      currentState: this.emptyToNull(step10.currentState),
      nextSteps: this.emptyToNull(step10.nextSteps),
      enhancements: this.emptyToNull(step10.enhancements),
      roadblocks: this.roadblocks.getRawValue().map((rb) => rb.trim()).filter(Boolean),
      parentProjectId: this.showParentProject ? step1.parentProjectId || null : null,
      processStatus: this.showProcessStatus ? (step1.processStatus as ProcessStatus | null) : null,
    };
  }

  private loadReferences(): void {
    const resolved = this.route.snapshot.data['refs'] as ProjectReferenceData | undefined;
    if (resolved) {
      this.references = resolved;
      this.loadParentProjects();
      this.loadProjectManagers();
      return;
    }

    this.referenceService.loadAll().subscribe({
      next: (refs) => {
        this.references = refs;
        this.loadParentProjects();
        this.loadProjectManagers();
      },
      error: () => this.notificationService.showError('Unable to load project reference data.'),
    });
  }

  private loadParentProjects(): void {
    this.referenceService.loadParentProjects().subscribe({
      next: (projects) => {
        this.references = {
          ...this.references,
          parentProjects: projects,
        };
      },
      error: () => {
        this.references = {
          ...this.references,
          parentProjects: [],
        };
      },
    });
  }

  private loadProjectManagers(): void {
    this.referenceService.loadProjectManagers().subscribe({
      next: (users) => (this.projectManagers = users),
      error: () => (this.projectManagers = []),
    });
  }

  private updateDynamicValidators(): void {
    const parentControl = this.step1Group.controls['parentProjectId'];
    const processControl = this.step1Group.controls['processStatus'];

    if (this.showParentProject) {
      parentControl.setValidators([Validators.required]);
    } else {
      parentControl.clearValidators();
      parentControl.setValue(null);
    }

    if (this.showProcessStatus) {
      processControl.setValidators([Validators.required]);
    } else {
      processControl.clearValidators();
      processControl.setValue(null);
    }

    parentControl.updateValueAndValidity({ emitEvent: false });
    processControl.updateValueAndValidity({ emitEvent: false });
  }

  private toApiDate(value: string | null | undefined): string | null {
    return value ? `${value}T00:00:00Z` : null;
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    return Number(value);
  }

  private emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private updateStepperOrientation(): void {
    if (typeof window === 'undefined') {
      this.stepperOrientation = 'horizontal';
      return;
    }
    // Use a high threshold because sidebar/open layout drastically reduces
    // effective content width even on desktop resolutions.
    this.stepperOrientation = window.innerWidth < 1800 ? 'vertical' : 'horizontal';
  }
}
