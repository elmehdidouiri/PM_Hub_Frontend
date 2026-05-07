import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';

import {
  AllocationFrequency,
  BookingType,
  CreateHourEntryDto,
  DateSelectionMode,
  InternSupervisionDto,
  ProjectInternAllocationDto,
  ProjectManagementType,
  resolveMyProjectOption,
} from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { Hour } from '../../services/hour';

@Component({
  selector: 'app-hour-entry',
  standalone: false,
  templateUrl: './hour-entry.html',
  styleUrl: './hour-entry.scss',
})
export class HourEntry implements OnInit {
  private readonly hours = inject(Hour);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly bookingTypeOptions = [
    { value: BookingType.Normal, label: 'Normal' },
    { value: BookingType.Premium, label: 'Premium' },
  ];

  readonly allocationFrequencyOptions = [
    { value: AllocationFrequency.Daily, label: 'Daily' },
    { value: AllocationFrequency.Weekly, label: 'Weekly' },
  ];

  readonly dateSelectionModeOptions = [
    { value: DateSelectionMode.SingleDay, label: 'Single day' },
    { value: DateSelectionMode.MultipleDays, label: 'Multiple days' },
    { value: DateSelectionMode.WeekRange, label: 'Week range' },
  ];

  readonly categoryOptions = [
    { value: ProjectManagementType.DigitalOperation,      label: 'Digital Operation' },
    { value: ProjectManagementType.DigitalSolution,       label: 'Digital Solution' },
    { value: ProjectManagementType.Infrastructure,        label: 'Infrastructure' },
    { value: ProjectManagementType.ProcessSimplification, label: 'Process Simplification' },
    { value: ProjectManagementType.Other,                 label: 'Other' },
  ];

  readonly dateSelectionMode = DateSelectionMode;
  readonly allocationFrequency = AllocationFrequency;

  projectOptions: Array<{ projectId: string; label: string }> = [];
  internOptions: SupervisedInternOption[] = [];
  selectedInterns: SupervisedInternSelection[] = [];
  selectedInternAllocationId = '';
  internDraftHours = 0;
  editingInternAllocationId: string | null = null;

  isLoadingProjects = true;
  isLoadingInterns = true;
  isSubmitting = false;
  projectsError = '';
  internsError = '';

  totalHours = 0;
  overtimeWarning = false;
  totalOver24 = false;

   selectedDatesList: Date[] = [];

  readonly form = this.fb.nonNullable.group({
    projectId: ['', Validators.required],
    allocationFrequency: [AllocationFrequency.Daily, Validators.required],
    dateSelectionMode: new FormControl<DateSelectionMode | null>(null, Validators.required),
    date: [new Date(), Validators.required],
    selectedDatesText: [''],
    rangeStartDate: [''],
    rangeEndDate: [''],
    category: [ProjectManagementType.DigitalOperation, Validators.required],
    activityNote: [''],
    bookingType: [BookingType.Normal, Validators.required],
    executionHours: [0, [Validators.required, Validators.min(0)]],
    technicalSupervisionHours: [0, [Validators.required, Validators.min(0)]],
    processRelatedHours: [0, [Validators.required, Validators.min(0)]],
    projectManagementHours: [0, [Validators.required, Validators.min(0)]],
    researchAndDevHours: [0, [Validators.required, Validators.min(0)]],
    workshopHours: [0, [Validators.required, Validators.min(0)]],
    otherActivitiesHours: [0, [Validators.required, Validators.min(0)]],
    internManagementHours: [0, [Validators.required, Validators.min(0)]],
    simpleTotalHours: [0, [Validators.min(0)]],
    notes: [''],
  });

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => {
      this.syncWeeklyMode();
      this.computeTotals();
    });

    this.loadProjects();
    this.loadSupervisedInterns();
  }

  /** Returns true when full project-work form should be shown */
  get isProjectWorkMode(): boolean {
    const cat = this.form.controls.category.value;
    return cat === ProjectManagementType.DigitalOperation ||
           cat === ProjectManagementType.ProcessSimplification;
  }

  get filteredDateModeOptions() {
    const freq = this.form.controls.allocationFrequency.value;
    if (freq === AllocationFrequency.Daily) {
      return this.dateSelectionModeOptions.filter(o => o.value !== DateSelectionMode.WeekRange);
    }
    return this.dateSelectionModeOptions;
  }

  get activeInternOptions(): SupervisedInternOption[] {
    const projectId = this.form.controls.projectId.value;
    if (!projectId) {
      return this.internOptions;
    }

    const scopedInterns = this.internOptions.filter((intern) => !intern.projectId || intern.projectId === projectId);
    return scopedInterns.length ? scopedInterns : this.internOptions;
  }

  get currentInternOption(): SupervisedInternOption | null {
    if (!this.selectedInternAllocationId) {
      return null;
    }

    return (
      this.activeInternOptions.find((intern) => intern.internAllocationId === this.selectedInternAllocationId) ??
      this.internOptions.find((intern) => intern.internAllocationId === this.selectedInternAllocationId) ??
      null
    );
  }

  get canSaveInternDraft(): boolean {
    return !!this.selectedInternAllocationId && this.internDraftHours > 0;
  }

  // Filter out weekends
  weekendFilter = (d: Date | null): boolean => {
    const day = (d || new Date()).getDay();
    return day !== 0 && day !== 6;
  }

  // Visual highlight for multi-dates
  dateClass = (d: Date): string => {
    if (this.form.controls.dateSelectionMode.value !== DateSelectionMode.MultipleDays) return '';
    
    const isSelected = this.selectedDatesList.some(
      sd => sd.getFullYear() === d.getFullYear() && 
            sd.getMonth() === d.getMonth() && 
            sd.getDate() === d.getDate()
    );
    return isSelected ? 'multi-selected-date' : '';
  }

  onDateSelected(selectedDate: Date | null): void {
    if (!selectedDate) return;

    if (this.form.controls.dateSelectionMode.value === DateSelectionMode.MultipleDays) {
      const index = this.selectedDatesList.findIndex(
        sd => sd.getFullYear() === selectedDate.getFullYear() && 
              sd.getMonth() === selectedDate.getMonth() && 
              sd.getDate() === selectedDate.getDate()
      );

      if (index >= 0) {
        this.selectedDatesList.splice(index, 1);
      } else {
        this.selectedDatesList.push(selectedDate);
      }
      this.form.controls.date.setValue(new Date(selectedDate), { emitEvent: false });  
    } else {
      this.form.controls.date.setValue(selectedDate);
    }
    this.cdr.markForCheck();
  }

  removeDate(date: Date): void {
    this.selectedDatesList = this.selectedDatesList.filter(d => d !== date);
    this.cdr.markForCheck();
  }

  submit(): void {
    if (!this.validateForm()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const selectedDates = this.buildSelectedDates(v);
    const isWeekRange = v.dateSelectionMode === DateSelectionMode.WeekRange;
    const rangeStartDate = isWeekRange ? this.toIsoDate(v.rangeStartDate) : undefined;
    const rangeEndDate = isWeekRange ? this.toIsoDate(v.rangeEndDate) : undefined;

    const payload: CreateHourEntryDto = {
      projectId: v.projectId || undefined,
      allocationFrequency: v.allocationFrequency,
      dateSelectionMode: v.dateSelectionMode!,
      selectedDates,
      rangeStartDate,
      rangeEndDate,
      category: v.category,
      bookingType: v.bookingType,
      executionHours: v.executionHours,
      technicalSupervisionHours: v.technicalSupervisionHours,
      processRelatedHours: v.processRelatedHours,
      projectManagementHours: v.projectManagementHours,
      researchAndDevHours: v.researchAndDevHours,
      workshopHours: v.workshopHours,
      otherActivitiesHours: v.otherActivitiesHours,
      internManagementHours: v.internManagementHours,
      supervisedInterns: this.selectedInterns
        .filter((intern) => intern.hours > 0)
        .map((intern) => ({ internAllocationId: intern.internAllocationId, hours: intern.hours })),
      notes: v.notes?.trim() ? v.notes.trim() : null,
    };

    this.isSubmitting = true;
    this.hours
      .createEntry(payload)
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.isSubmitting = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: (result) => {
          if (!result) {
            this.zone.run(() => {
              this.notifications.showError('Unable to save hours.');
              this.cdr.markForCheck();
            });
            return;
          }
          this.zone.run(() => {
            this.notifications.showSuccess('Hours saved for the selected project.');
            this.resetForm();
            this.cdr.markForCheck();
          });
        },
        error: (err: unknown) => {
          this.zone.run(() => {
            this.notifications.showError(this.extractApiError(err));
            this.cdr.markForCheck();
          });
        },
      });
  }

  onProjectChanged(): void {
    const projectId = this.form.controls.projectId.value;
    this.selectedInternAllocationId = '';
    this.internDraftHours = 0;
    this.editingInternAllocationId = null;

    if (projectId) {
      this.selectedInterns = this.selectedInterns.filter((intern) => !intern.projectId || intern.projectId === projectId);
    }

    this.computeTotals();
    this.cdr.markForCheck();
  }

  onInternSelectionChanged(internAllocationId: string): void {
    this.selectedInternAllocationId = internAllocationId;

    const existing = this.selectedInterns.find((intern) => intern.internAllocationId === internAllocationId);
    if (existing) {
      this.editingInternAllocationId = existing.internAllocationId;
      this.internDraftHours = existing.hours;
    } else {
      this.editingInternAllocationId = null;
      this.internDraftHours = 0;
    }

    this.cdr.markForCheck();
  }

  onInternDraftHoursChanged(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.internDraftHours = Number.isFinite(value) && value >= 0 ? value : 0;
    this.cdr.markForCheck();
  }

  saveInternDraft(): void {
    const option = this.currentInternOption;
    if (!option || this.internDraftHours <= 0) {
      return;
    }

    const nextSelection: SupervisedInternSelection = {
      internAllocationId: option.internAllocationId,
      internName: option.internName,
      hours: this.internDraftHours,
      projectId: option.projectId,
      projectLabel: option.projectLabel,
      allocatedHours: option.allocatedHours,
      hoursWorked: option.hoursWorked,
      remainingHours: option.remainingHours,
    };

    const existingIndex = this.selectedInterns.findIndex((intern) => intern.internAllocationId === option.internAllocationId);
    if (existingIndex >= 0) {
      this.selectedInterns[existingIndex] = nextSelection;
    } else {
      this.selectedInterns = [...this.selectedInterns, nextSelection];
    }

    this.selectedInternAllocationId = '';
    this.internDraftHours = 0;
    this.editingInternAllocationId = null;
    this.computeTotals();
    this.cdr.markForCheck();
  }

  editInternSelection(intern: SupervisedInternSelection): void {
    this.selectedInternAllocationId = intern.internAllocationId;
    this.internDraftHours = intern.hours;
    this.editingInternAllocationId = intern.internAllocationId;
    this.cdr.markForCheck();
  }

  removeInternSelection(internAllocationId: string): void {
    const intern = this.selectedInterns.find(i => i.internAllocationId === internAllocationId);
    if (!intern) return;

    const data: ConfirmationDialogData = {
      title: 'Remove Intern Supervision',
      message: `Are you sure you want to remove the supervision hours for ${intern.internName}?`,
      icon: 'person_remove',
      saveLabel: 'Remove',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'save') {
        this.executeRemoveIntern(internAllocationId);
      }
    });
  }

  private executeRemoveIntern(internAllocationId: string): void {
    this.selectedInterns = this.selectedInterns.filter((intern) => intern.internAllocationId !== internAllocationId);

    if (this.selectedInternAllocationId === internAllocationId) {
      this.selectedInternAllocationId = '';
      this.internDraftHours = 0;
      this.editingInternAllocationId = null;
    }

    this.computeTotals();
    this.cdr.markForCheck();
  }

  private loadProjects(): void {
    this.hours
      .myProjects()
      .pipe(
        catchError(() => {
          this.zone.run(() => {
            this.projectsError = 'Unable to load your assigned projects.';
            this.cdr.markForCheck();
          });
          return of([] as unknown[]);
        }),
        finalize(() => {
          this.zone.run(() => {
            this.isLoadingProjects = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe((rows) => {
        this.zone.run(() => {
          this.projectOptions = (rows as unknown[])
            .map((row) => resolveMyProjectOption(row))
            .filter((x): x is NonNullable<typeof x> => x !== null);
          this.cdr.markForCheck();
        });
      });
  }

  private loadSupervisedInterns(): void {
    this.hours
      .mySupervisedInterns()
      .pipe(
        catchError(() => {
          this.zone.run(() => {
            this.internsError = 'Unable to load supervised interns.';
            this.cdr.markForCheck();
          });
          return of([] as ProjectInternAllocationDto[]);
        }),
        finalize(() => {
          this.zone.run(() => {
            this.isLoadingInterns = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe((rows) => {
        this.zone.run(() => {
          this.internOptions = (rows as unknown[])
            .map((row) => this.mapInternOption(row))
            .filter((item): item is SupervisedInternOption => item !== null);
          this.selectedInterns = [];
          this.cdr.markForCheck();
        });
      });
  }

  private validateForm(): boolean {
    const validBase = !this.form.invalid && !!this.projectOptions.length;
    const values = this.form.getRawValue();
    const selectedDates = this.buildSelectedDates(values);
    const validDates = this.hasValidDateSelection(values.dateSelectionMode, selectedDates);

    this.totalOver24 = this.totalHours > 24;

    return validBase && validDates && !this.totalOver24;
  }

  private syncWeeklyMode(): void {
    const frequency = this.form.controls.allocationFrequency.value;
    if (frequency === AllocationFrequency.Weekly && this.form.controls.dateSelectionMode.value !== DateSelectionMode.WeekRange) {
      this.form.controls.dateSelectionMode.setValue(DateSelectionMode.WeekRange, { emitEvent: false });
    }
  }

  private computeTotals(): void {
    const v = this.form.getRawValue();
    if (this.isProjectWorkMode) {
      const categoriesTotal =
        v.executionHours +
        v.technicalSupervisionHours +
        v.processRelatedHours +
        v.projectManagementHours +
        v.researchAndDevHours +
        v.workshopHours +
        v.otherActivitiesHours +
        v.internManagementHours;
      const internHours = this.selectedInterns.reduce((sum, intern) => sum + intern.hours, 0);
      this.totalHours = categoriesTotal + internHours;
    } else {
      this.totalHours = v.simpleTotalHours;
    }
    this.overtimeWarning = this.totalHours > 9;
    this.totalOver24 = this.totalHours > 24;
  }

  private buildSelectedDates(values: any): string[] {
    switch (values.dateSelectionMode) {
      case DateSelectionMode.SingleDay:
        return values.date instanceof Date ? [this.formatDate(values.date)] : [];
      case DateSelectionMode.MultipleDays:
        return this.selectedDatesList.map(d => this.formatDate(d));
      case DateSelectionMode.WeekRange: {
        const startDate = this.toIsoDate(values.rangeStartDate);
        const endDate = this.toIsoDate(values.rangeEndDate);
        return startDate && endDate ? [startDate, endDate] : [];
      }
      default:
        return [];
    }
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`;
  }

  private toIsoDate(value: Date | string | null | undefined): string {
    if (!value) return '';

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())).toISOString();
    }

    const raw = value.trim();
    if (!raw) return '';
    const normalized = raw.includes('T') ? raw : `${raw}T00:00:00Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  private hasValidDateSelection(mode: DateSelectionMode | null, selectedDates: string[]): boolean {
    if (mode === DateSelectionMode.WeekRange) {
      return selectedDates.length === 2;
    }
    return selectedDates.length > 0;
  }

  private extractApiError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const apiError = err.error;
      if (Array.isArray(apiError?.errors) && apiError.errors.length > 0) {
        return apiError.errors.join(' | ');
      }
      if (typeof apiError?.message === 'string' && apiError.message.trim()) {
        return apiError.message.trim();
      }
      if (typeof err.message === 'string' && err.message.trim()) {
        return err.message.trim();
      }
      return `Request failed with status ${err.status}`;
    }

    if (err instanceof Error && err.message.trim()) {
      return err.message.trim();
    }

    return 'Unable to save hours.';
  }

  private resetForm(): void {
    this.form.patchValue({
      allocationFrequency: AllocationFrequency.Daily,
      dateSelectionMode: null,
      date: new Date(),
      selectedDatesText: '',
      rangeStartDate: '',
      rangeEndDate: '',
      category: ProjectManagementType.DigitalOperation,
      activityNote: '',
      bookingType: BookingType.Normal,
      executionHours: 0,
      technicalSupervisionHours: 0,
      processRelatedHours: 0,
      projectManagementHours: 0,
      researchAndDevHours: 0,
      workshopHours: 0,
      otherActivitiesHours: 0,
      internManagementHours: 0,
      simpleTotalHours: 0,
      notes: '',
    });
    this.selectedDatesList = [];
    this.selectedInterns = [];
    this.selectedInternAllocationId = '';
    this.internDraftHours = 0;
    this.editingInternAllocationId = null;
    this.totalHours = 0;
    this.overtimeWarning = false;
    this.totalOver24 = false;
  }

  private mapInternOption(row: unknown): SupervisedInternOption | null {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const source = row as Record<string, unknown>;
    const rawAllocationId =
      source['internAllocationId'] ?? source['InternAllocationId'] ?? source['id'] ?? source['Id'];
    const internAllocationId = typeof rawAllocationId === 'string' ? rawAllocationId : null;
    if (!internAllocationId) {
      return null;
    }

    const rawName = source['internName'] ?? source['InternName'] ?? source['name'] ?? source['Name'];
    const internName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : internAllocationId;

    const rawProjectId = source['projectId'] ?? source['ProjectId'];
    const projectId = typeof rawProjectId === 'string' && rawProjectId.trim() ? rawProjectId.trim() : null;

    const rawProjectName = source['projectName'] ?? source['ProjectName'];
    const projectLabel =
      typeof rawProjectName === 'string' && rawProjectName.trim() ? rawProjectName.trim() : 'Current project';

    return {
      internAllocationId,
      internName,
      projectId,
      projectLabel,
      allocatedHours: this.toNullableNumber(source['allocatedHours'] ?? source['AllocatedHours']),
      hoursWorked: this.toNullableNumber(source['hoursWorked'] ?? source['HoursWorked']),
      remainingHours: this.toNullableNumber(source['remainingHours'] ?? source['RemainingHours']),
    };
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}

interface SupervisedInternOption extends ProjectInternAllocationDto {
  internName: string;
  projectId: string | null;
  projectLabel: string;
  allocatedHours: number | null;
  hoursWorked: number | null;
  remainingHours: number | null;
}

interface SupervisedInternSelection extends InternSupervisionDto {
  internName: string;
  projectId: string | null;
  projectLabel: string;
  allocatedHours: number | null;
  hoursWorked: number | null;
  remainingHours: number | null;
}
