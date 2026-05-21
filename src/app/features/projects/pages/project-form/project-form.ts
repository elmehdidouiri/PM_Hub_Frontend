import { Component, HostListener, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, of, catchError, map } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  ConfirmationDialog,
  ConfirmationDialogResult,
} from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
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
  private readonly draftStorageKey = 'pmhub.project.create.draft';
  private readonly allowedProjectFileExtensions = new Set(['.pdf', '.xlsx', '.docx', '.pptx']);
  private readonly allowedProjectFileContentTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);
  private readonly maxProjectFileSizeBytes = 10 * 1024 * 1024;
  protected readonly ProcessStatus = ProcessStatus;
  protected readonly ProjectPhase = ProjectPhase;
  protected readonly ProjectStatus = ProjectStatus;
  protected readonly ProjectFileType = ProjectFileType;
  isSubmitting = false;
  stepperOrientation: 'horizontal' | 'vertical' = 'vertical';
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
    { value: ProjectManagementType.DigitalOperation, label: 'Digital Operation' },
    { value: ProjectManagementType.DigitalSolution, label: 'Digital Solution' },
    { value: ProjectManagementType.Infrastructure, label: 'Infrastructure' },
    { value: ProjectManagementType.ProcessSimplification, label: 'Process Simplification' },
    { value: ProjectManagementType.Other, label: 'Other' },
  ];
  readonly phaseOptions = Object.values(ProjectPhase).filter((v): v is ProjectPhase => typeof v === 'number');
  readonly statusOptions = Object.values(ProjectStatus).filter((v): v is ProjectStatus => typeof v === 'number');
  readonly processStatusOptions = Object.values(ProcessStatus).filter((v): v is ProcessStatus => typeof v === 'number');

  readonly memberDraft: FormGroup;
  readonly budgetDraft: FormGroup;
  readonly roadblockDraft: FormControl<string>;
  readonly businessUnitDraft: FormControl<string>;
  readonly plantDraft: FormControl<string>;
  readonly departmentDraft: FormControl<string>;
  readonly technologyDraft: FormControl<string>;
  readonly solutionDomainDraft: FormControl<string>;
  readonly fileTypeDraft: FormControl<ProjectFileType | null>;
  readonly fileDescriptionDraft: FormControl<string>;
  readonly wizardForm: FormGroup;
  pendingProjectFile: File | null = null;
  pendingProjectFileError = '';
  private submittedSuccessfully = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly projectService: ProjectService,
    private readonly referenceService: ProjectReferenceService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog
  ) {
    this.memberDraft = this.fb.group({
      userId: this.fb.nonNullable.control('', Validators.required),
      role: this.fb.nonNullable.control('', Validators.required),
      roleId: this.fb.nonNullable.control('', Validators.required),
    });

    this.budgetDraft = this.fb.group({
      itemName: this.fb.nonNullable.control('', Validators.required),
      pricePerUnit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
      costCenter: this.fb.nonNullable.control('', Validators.required),
    });

    this.roadblockDraft = this.fb.nonNullable.control('');
    this.businessUnitDraft = this.fb.nonNullable.control('');
    this.plantDraft = this.fb.nonNullable.control('');
    this.departmentDraft = this.fb.nonNullable.control('');
    this.technologyDraft = this.fb.nonNullable.control('');
    this.solutionDomainDraft = this.fb.nonNullable.control('');
    this.fileTypeDraft = this.fb.control<ProjectFileType | null>(null, Validators.required);
    this.fileDescriptionDraft = this.fb.nonNullable.control('');

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
      }, { validators: this.phaseStatusValidator }),
      step3: this.fb.group({
        projectManagerId: this.fb.control<string | null>(null),
        sponsor: this.fb.nonNullable.control(''),
        businessUnitIds: this.fb.nonNullable.control<string[]>([], Validators.minLength(1)),
        plantName: this.fb.nonNullable.control(''),
        departmentId: this.fb.nonNullable.control(''),
        departmentIds: this.fb.nonNullable.control<string[]>([], Validators.minLength(1)),
        costCenter: this.fb.nonNullable.control(''),
        costSaving: this.fb.control<number | null>(null, Validators.min(0)),
      }),
      step4: this.fb.group({
        technologyIds: this.fb.nonNullable.control<string[]>([]),
        solutionDomainIds: this.fb.nonNullable.control<string[]>([]),
      }),
      step5: this.fb.group({
        startDate: this.fb.nonNullable.control(''),
        endDate: this.fb.nonNullable.control(''),
        estimatedDueDate: this.fb.nonNullable.control(''),
        estimatedHours: this.fb.control<number | null>(null, Validators.min(0)),
        actualHours: this.fb.control<number | null>(null, Validators.min(0)),
      }),
      step6: this.fb.group({
        financialImpact: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        customerImpact: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        operationalEfficiency: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        strategicAlignment: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        crossFunctionalImpact: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        innovationDigitalisation: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        riskMitigationUrgency: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
        sustainabilityESG: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(10)]),
      }),
      step7: this.fb.group({
        teamMembers: this.fb.array<FormGroup>([]),
      }),
      step8: this.fb.group({
        budgetItems: this.fb.array<FormGroup>([]),
      }),
      step9: this.fb.group({
        currentState: this.fb.nonNullable.control(''),
        nextSteps: this.fb.nonNullable.control(''),
        enhancements: this.fb.nonNullable.control(''),
        codeSourceLink: this.fb.nonNullable.control(''),
        solutionLink: this.fb.nonNullable.control(''),
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

    if (start && end && new Date(end) <= new Date(start)) {
      errors['endDateInvalid'] = true;
      hasError = true;
    }

    if (start && estimated && new Date(estimated) <= new Date(start)) {
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
    const selectedFile = files && files.length > 0 ? files[0] : null;
    const validationError = this.validateProjectFile(selectedFile);

    if (validationError) {
      this.pendingProjectFile = null;
      this.pendingProjectFileError = validationError;
      this.notificationService.showWarning(validationError);
      event.target.value = '';
      return;
    }

    this.pendingProjectFile = selectedFile;
    this.pendingProjectFileError = '';
  }

  addProjectFile(fileInput?: HTMLInputElement): void {
    if (this.fileTypeDraft.invalid || !this.pendingProjectFile) {
      this.fileTypeDraft.markAsTouched();
      if (!this.pendingProjectFile) {
        this.pendingProjectFileError = 'File is required before attaching a document.';
      }
      return;
    }

    const validationError = this.validateProjectFile(this.pendingProjectFile);
    if (validationError) {
      this.pendingProjectFileError = validationError;
      this.notificationService.showWarning(validationError);
      return;
    }

    if (this.isProjectFileTypeSelected(this.fileTypeDraft.value)) {
      this.fileTypeDraft.setErrors({ duplicateFileType: true });
      this.fileTypeDraft.markAsTouched();
      this.notificationService.showWarning('Only one project file is allowed for each document type.');
      return;
    }

    this.projectFiles.push({
      file: this.pendingProjectFile,
      fileType: this.fileTypeDraft.value as ProjectFileType,
      description: this.fileDescriptionDraft.value.trim() || undefined,
      fileName: this.pendingProjectFile.name,
    });

    this.pendingProjectFile = null;
    this.pendingProjectFileError = '';
    this.fileTypeDraft.reset(null);
    this.fileDescriptionDraft.reset('');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  removeFile(index: number): void {
    this.projectFiles.splice(index, 1);
    this.fileTypeDraft.updateValueAndValidity();
  }

  ngOnInit(): void {
    this.updateStepperOrientation();
    this.loadReferences();
    this.restoreDraft();
    this.updateDynamicValidators();
    this.step1Group.controls['projectManagementType'].valueChanges.subscribe(() => this.updateDynamicValidators());
    this.step1Group.controls['projectType'].valueChanges.subscribe(() => this.updateDynamicValidators());
    this.step3Group.controls['projectManagerId'].valueChanges.subscribe((pmUserId) => this.onProjectManagerChange(pmUserId));
    this.memberDraft.controls['userId'].valueChanges.subscribe((userId) => this.syncMemberRole(userId));
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateStepperOrientation();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) {
      return;
    }

    this.saveDraft(false);
    event.preventDefault();
    event.returnValue = '';
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

  get strategicScoreTotal(): number {
    return Object.values(this.step6Group.getRawValue()).reduce<number>(
      (total, value) => total + (Number(value) || 0),
      0
    );
  }

  get strategicScoreAverage(): number {
    return Math.round((this.strategicScoreTotal / 8) * 10) / 10;
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

  get selectedDepartments(): SelectOption[] {
    const ids = this.step3Group.controls['departmentIds'].value ?? [];
    const selected = new Set(ids);
    return this.references.departments.filter((department) => selected.has(department.id));
  }

  get selectedPlants(): SelectOption[] {
    const names = new Set(this.selectedPlantNames);
    return this.references.plants.filter((plant) => names.has(plant.label));
  }

  get selectedPlantNames(): string[] {
    return this.splitPlantNames(this.step3Group.controls['plantName'].value);
  }

  get availableDepartments(): SelectOption[] {
    const plantNames = new Set(this.selectedPlantNames);
    if (!plantNames.size) {
      return this.references.departments;
    }

    return this.references.departments.filter((department) => !department.plantName || plantNames.has(department.plantName));
  }

  addTeamMember(): void {
    if (this.memberDraft.invalid) {
      this.memberDraft.markAllAsTouched();
      return;
    }
    if (this.isProjectManager(this.memberDraft.controls['userId'].value)) {
      this.notificationService.showWarning('The project manager is managed separately from team members.');
      return;
    }
    this.teamMembers.push(this.fb.group(this.memberDraft.getRawValue()));
    this.memberDraft.reset({ userId: '', role: '', roleId: '' });
  }

  userLabel(userId: string): string {
    return this.references.users.find((user) => user.id === userId)?.label || userId;
  }

  userEmail(userId: string): string {
    return this.references.users.find((user) => user.id === userId)?.email || '';
  }

  userInitials(userId: string): string {
    const label = this.userLabel(userId);
    const initials = label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    return initials || 'TM';
  }

  removeTeamMember(index: number): void {
    this.teamMembers.removeAt(index);
  }

  onProjectManagerChange(pmUserId: string | null): void {
    this.removeProjectManagerFromTeam(pmUserId);
    if (this.isProjectManager(this.memberDraft.controls['userId'].value)) {
      this.memberDraft.reset({ userId: '', role: '', roleId: '' });
    }
  }

  public isProjectManager(userId: string | null | undefined): boolean {
    const pmUserId = this.step3Group.controls['projectManagerId'].value;
    return !!userId && !!pmUserId && userId === pmUserId;
  }

  addBudgetItem(): void {
    if (this.budgetDraft.invalid) {
      this.budgetDraft.markAllAsTouched();
      return;
    }
    this.budgetItems.push(this.fb.group(this.budgetDraft.getRawValue()));
    this.budgetDraft.reset({ itemName: '', pricePerUnit: null, quantity: null, costCenter: '' });
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

  addPlant(): void {
    const selectedName = this.plantDraft.value;
    if (!selectedName) {
      return;
    }

    const current = this.selectedPlantNames;
    if (!current.includes(selectedName)) {
      this.step3Group.controls['plantName'].setValue([...current, selectedName].join(', '));
      this.step3Group.controls['plantName'].markAsDirty();
      this.step3Group.controls['plantName'].updateValueAndValidity();
    }

    this.plantDraft.setValue('');
  }

  removePlant(name: string): void {
    const next = this.selectedPlantNames.filter((item) => item !== name);
    this.step3Group.controls['plantName'].setValue(next.join(', '));
    this.step3Group.controls['plantName'].markAsDirty();
    this.step3Group.controls['plantName'].updateValueAndValidity();
  }

  addDepartment(): void {
    const selectedId = this.departmentDraft.value;
    if (!selectedId) {
      return;
    }

    const current = this.step3Group.controls['departmentIds'].value ?? [];
    if (!current.includes(selectedId)) {
      const next = [...current, selectedId];
      this.step3Group.controls['departmentIds'].setValue(next);
      this.step3Group.controls['departmentId'].setValue(next[0] ?? '');
      this.step3Group.controls['departmentIds'].markAsDirty();
      this.step3Group.controls['departmentIds'].updateValueAndValidity();
    }

    this.departmentDraft.setValue('');
  }

  removeDepartment(id: string): void {
    const current = this.step3Group.controls['departmentIds'].value ?? [];
    const next = current.filter((item: string) => item !== id);
    this.step3Group.controls['departmentIds'].setValue(next);
    this.step3Group.controls['departmentId'].setValue(next[0] ?? '');
    this.step3Group.controls['departmentIds'].markAsDirty();
    this.step3Group.controls['departmentIds'].updateValueAndValidity();
  }

  get selectedTechnologies(): SelectOption[] {
    const ids = this.step4Group.controls['technologyIds'].value ?? [];
    const selected = new Set(ids);
    return this.references.technologies.filter((technology) => selected.has(technology.id));
  }

  get selectedSolutionDomains(): SelectOption[] {
    const ids = this.step4Group.controls['solutionDomainIds'].value ?? [];
    const selected = new Set(ids);
    return this.references.solutionDomains.filter((solution) => selected.has(solution.id));
  }

  addTechnology(): void {
    const selectedId = this.technologyDraft.value;
    if (!selectedId) {
      return;
    }

    const current = this.step4Group.controls['technologyIds'].value ?? [];
    if (!current.includes(selectedId)) {
      this.step4Group.controls['technologyIds'].setValue([...current, selectedId]);
      this.step4Group.controls['technologyIds'].markAsDirty();
      this.step4Group.controls['technologyIds'].updateValueAndValidity();
    }

    this.technologyDraft.setValue('');
  }

  removeTechnology(id: string): void {
    const current = this.step4Group.controls['technologyIds'].value ?? [];
    this.step4Group.controls['technologyIds'].setValue(current.filter((item: string) => item !== id));
    this.step4Group.controls['technologyIds'].markAsDirty();
    this.step4Group.controls['technologyIds'].updateValueAndValidity();
  }

  addSolutionDomain(): void {
    const selectedId = this.solutionDomainDraft.value;
    if (!selectedId) {
      return;
    }

    const current = this.step4Group.controls['solutionDomainIds'].value ?? [];
    if (!current.includes(selectedId)) {
      this.step4Group.controls['solutionDomainIds'].setValue([...current, selectedId]);
      this.step4Group.controls['solutionDomainIds'].markAsDirty();
      this.step4Group.controls['solutionDomainIds'].updateValueAndValidity();
    }

    this.solutionDomainDraft.setValue('');
  }

  removeSolutionDomain(id: string): void {
    const current = this.step4Group.controls['solutionDomainIds'].value ?? [];
    this.step4Group.controls['solutionDomainIds'].setValue(current.filter((item: string) => item !== id));
    this.step4Group.controls['solutionDomainIds'].markAsDirty();
    this.step4Group.controls['solutionDomainIds'].updateValueAndValidity();
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
        this.notificationService.showWarning('Project end date must be strictly after the start date.');
      } else if (this.wizardForm.errors?.['estimatedDateInvalid']) {
        this.notificationService.showWarning('Estimated due date must be strictly after the start date.');
      } else if (this.step2Group.errors?.['invalidPhaseStatus']) {
        this.notificationService.showWarning(this.phaseStatusError());
      } else {
        this.notificationService.showWarning('Please complete all required fields before submitting.');
      }
      return;
    }

     setTimeout(() => {
      this.isSubmitting = true;
    });

    const payload = this.buildCreatePayload();

    this.projectService.createProject(payload).subscribe({
      next: (project) => {
        this.submittedSuccessfully = true;
        this.clearDraft(false);
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

  isProjectFileTypeSelected(fileType: ProjectFileType | null): boolean {
    return fileType !== null && this.projectFiles.some((file) => file.fileType === fileType);
  }

  strategicCriterionError(controlName: string): string {
    const control = this.step6Group.get(controlName);
    if (!this.isInvalid(control)) {
      return '';
    }

    if (control?.errors?.['required']) {
      return 'This score is required.';
    }

    if (control?.errors?.['min'] || control?.errors?.['max']) {
      return 'Enter a score between 0 and 10.';
    }

    return 'Invalid score.';
  }

  phaseStatusError(): string {
    if (!this.step2Group.errors?.['invalidPhaseStatus']) {
      return '';
    }

    return 'Pipeline projects must use the Planned status before they can be submitted.';
  }

  projectFileTypeError(): string {
    if (!this.isInvalid(this.fileTypeDraft)) {
      return '';
    }

    if (this.fileTypeDraft.errors?.['duplicateFileType']) {
      return 'This document type already has a file.';
    }

    if (this.fileTypeDraft.errors?.['required']) {
      return 'Document type is required before attaching a file.';
    }

    return 'Invalid document type.';
  }

  hasUnsavedChanges(): boolean {
    return !this.submittedSuccessfully && (this.wizardForm.dirty || this.projectFiles.length > 0 || !!this.pendingProjectFile);
  }

  confirmDiscardOrSave(): Observable<boolean> | boolean {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    return this.dialog
      .open<ConfirmationDialog, unknown, ConfirmationDialogResult>(ConfirmationDialog, {
        panelClass: 'pm-dialog-panel',
        disableClose: true,
        data: {
          title: 'Project draft not finished',
          message:
            'You have an unfinished project creation. Save it as a draft, discard it, or continue editing before doing something else.',
          saveLabel: 'Save draft',
          discardLabel: 'Discard draft',
          cancelLabel: 'Continue editing',
        },
      })
      .afterClosed()
      .pipe(
        map((result) => {
          if (result === 'save') {
            this.saveDraft(true);
            return true;
          }

          if (result === 'discard') {
            this.clearDraft(true);
            return true;
          }

          return false;
        })
      );
  }

  private buildCreatePayload(): any {
    const step1 = this.step1Group.getRawValue();
    const step2 = this.step2Group.getRawValue();
    const step3 = this.step3Group.getRawValue();
    const step4 = this.step4Group.getRawValue();
    const step5 = this.step5Group.getRawValue();
    const step6 = this.step6Group.getRawValue();
    const step8 = this.step8Group.getRawValue();
    const step9 = this.step9Group.getRawValue();

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
      departmentId: step3.departmentIds?.[0] ?? step3.departmentId,
      departmentIds: step3.departmentIds ?? [],
      costCenter: this.emptyToNull(step3.costCenter),
      costSaving: this.numberOrNull(step3.costSaving),
      technologyIds: step4.technologyIds ?? [],
      solutionDomainIds: step4.solutionDomainIds ?? [],
      startDate: this.toApiDate(step5.startDate),
      endDate: this.toApiDate(step5.endDate),
      estimatedDueDate: this.toApiDate(step5.estimatedDueDate),
      estimatedHours: this.numberOrNull(step5.estimatedHours),
      actualHours: this.numberOrNull(step5.actualHours),
      strategicCriteria: step6,
      kpi: {
        customerSatisfaction: null,
        digitalContribution: null,
      },
      teamMembers: this.teamMembers.getRawValue().filter((item) => !this.isProjectManager(String(item['userId']))).map((item) => ({
        userId: String(item['userId']),
        role: String(item['role']).trim(),
        roleId: String(item['roleId'] || this.roleIdForUser(String(item['userId']))).trim(),
      })),
      budgetItems: (step8.budgetItems || []).map((item: Record<string, unknown>) => ({
        itemName: String(item['itemName'] || '').trim(),
        pricePerUnit: this.numberOrNull(item['pricePerUnit']) ?? 0,
        quantity: this.numberOrNull(item['quantity']) ?? 0,
        costCenter: String(item['costCenter'] || '').trim(),
      })),
      currentState: this.emptyToNull(step9.currentState),
      nextSteps: this.emptyToNull(step9.nextSteps),
      enhancements: this.emptyToNull(step9.enhancements),
      codeSourceLink: this.emptyToNull(step9.codeSourceLink),
      solutionLink: this.emptyToNull(step9.solutionLink),
      roadblocks: this.roadblocks.getRawValue(),
      parentProjectId: this.showParentProject ? step1.parentProjectId || null : null,
      processStatus: this.showProcessStatus ? (step1.processStatus as ProcessStatus | null) : null,
    };
  }

  isStatusAllowedForPhase(status: ProjectStatus, phase = this.step2Group.controls['phase'].value): boolean {
    if (phase === ProjectPhase.Pipeline) {
      return status === ProjectStatus.Planned;
    }

    return true;
  }

  private phaseStatusValidator(group: AbstractControl): { invalidPhaseStatus: true } | null {
    const phase = group.get('phase')?.value as ProjectPhase | null;
    const status = group.get('status')?.value as ProjectStatus | null;

    if (phase === ProjectPhase.Pipeline && status !== null && status !== ProjectStatus.Planned) {
      return { invalidPhaseStatus: true };
    }

    return null;
  }

  private syncMemberRole(userId: string): void {
    const selectedUser = this.references.users.find((user) => user.id === userId);
    this.memberDraft.controls['role'].setValue(selectedUser?.roleName || '');
    this.memberDraft.controls['roleId'].setValue(this.roleIdForUser(userId));
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

  private saveDraft(showNotification: boolean): void {
    const draft = {
      savedAt: new Date().toISOString(),
      form: this.wizardForm.getRawValue(),
      teamMembers: this.teamMembers.getRawValue(),
      budgetItems: this.budgetItems.getRawValue(),
      roadblocks: this.roadblocks.getRawValue(),
    };

    localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
    if (showNotification) {
      this.notificationService.showSuccess('Project draft saved.');
    }
  }

  private clearDraft(showNotification: boolean): void {
    localStorage.removeItem(this.draftStorageKey);
    this.wizardForm.markAsPristine();
    this.pendingProjectFile = null;
    this.projectFiles = [];
    if (showNotification) {
      this.notificationService.showInfo('Project draft discarded.');
    }
  }

  private restoreDraft(): void {
    const rawDraft = localStorage.getItem(this.draftStorageKey);
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as {
        form?: Record<string, any>;
        teamMembers?: Array<Record<string, unknown>>;
        budgetItems?: Array<Record<string, unknown>>;
        roadblocks?: string[];
      };

      if (draft.form) {
        this.wizardForm.patchValue(draft.form, { emitEvent: false });
        const rawDepartmentIds = draft.form['step3']?.['departmentIds'];
        const rawDepartmentId = draft.form['step3']?.['departmentId'];
        if ((!Array.isArray(rawDepartmentIds) || rawDepartmentIds.length === 0) && typeof rawDepartmentId === 'string' && rawDepartmentId) {
          this.step3Group.controls['departmentIds'].setValue([rawDepartmentId]);
        }
      }

      this.teamMembers.clear();
      (draft.teamMembers || []).forEach((member) => this.teamMembers.push(this.fb.group(member)));
      this.removeProjectManagerFromTeam(this.step3Group.controls['projectManagerId'].value, false);

      this.budgetItems.clear();
      (draft.budgetItems || []).forEach((item) => this.budgetItems.push(this.fb.group(item)));

      this.roadblocks.clear();
      (draft.roadblocks || []).forEach((roadblock) => {
        if (roadblock) {
          this.roadblocks.push(this.fb.nonNullable.control(String(roadblock)));
        }
      });

      this.wizardForm.markAsPristine();
      this.notificationService.showInfo('Saved project draft restored.');
    } catch {
      localStorage.removeItem(this.draftStorageKey);
    }
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

  private removeProjectManagerFromTeam(pmUserId: string | null, markDirty = true): void {
    if (!pmUserId) {
      return;
    }

    for (let index = this.teamMembers.length - 1; index >= 0; index--) {
      if (this.teamMembers.at(index).get('userId')?.value === pmUserId) {
        this.teamMembers.removeAt(index);
        if (markDirty) {
          this.teamMembers.markAsDirty();
        }
      }
    }
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

  private validateProjectFile(file: File | null): string {
    if (!file) {
      return 'File is required before attaching a document.';
    }

    if (file.size <= 0) {
      return 'File cannot be empty.';
    }

    if (file.size > this.maxProjectFileSizeBytes) {
      return 'File size cannot exceed 10 MB.';
    }

    const extension = this.fileExtension(file.name);
    if (!this.allowedProjectFileExtensions.has(extension)) {
      return 'Allowed file extensions are .pdf, .xlsx, .docx and .pptx.';
    }

    if (!this.allowedProjectFileContentTypes.has(file.type)) {
      return 'Allowed file types are PDF, Excel, Word and PowerPoint.';
    }

    return '';
  }

  private fileExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    return Number(value);
  }

  private emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private splitPlantNames(value: string | null | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
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
