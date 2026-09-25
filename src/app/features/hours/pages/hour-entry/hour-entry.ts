import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

import {
  AllocationFrequency,
  BookingType,
  CategoryWork,
  CreateHourEntryDto,
  DateSelectionMode,
  HourEntryDto,
  HourEntryUpdateDto,
  InternSupervisionDto,
  ProjectInternAllocationDto,
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
    { value: DateSelectionMode.WeekRange, label: 'Weekly range' },
  ];

  readonly categoryOptions = [
    { value: CategoryWork.Project,      label: 'Project' },
    { value: CategoryWork.Holiday,       label: 'Holiday' },
    { value: CategoryWork.Other,        label: 'Other' },
    { value: CategoryWork.MonthlyMeeting, label: 'Monthly meeting' },
    { value: CategoryWork.Workshop,     label: 'Workshop' },

  ];

  readonly dateSelectionMode = DateSelectionMode;
  readonly allocationFrequency = AllocationFrequency;

  projectOptions: Array<{ projectId: string; label: string }> = [];
  internOptions: SupervisedInternOption[] = [];
  selectedInterns: SupervisedInternSelection[] = [];
  selectedInternAllocationId = '';
  internDraftHours = 0;
  editingInternAllocationId: string | null = null;

  // ── Multi-project booking ────────────────────────────────────────
  /** IDs of all projects chosen in the multi-select */
  selectedProjectIds: string[] = [];
  /** Live search text inside the project select panel */
  projectSearchQuery = '';
  /** Which selected project is currently shown in the pager (0-based) */
  currentProjectPage = 0;
  // ─────────────────────────────────────────────────────────────────

  isLoadingProjects = true;
  isLoadingInterns = true;
  isSubmitting = false;
  isLoadingRecentEntries = true;
  isLoadingMonthlyDashboard = true;
  projectsError = '';
  internsError = '';
  recentEntriesError = '';
  recentEntries: HourEntryDto[] = [];
  monthlyDashboard: HourEntryMonthlyFocus | null = null;
  editingEntryId: string | null = null;

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
    category: [CategoryWork.Project, Validators.required],
    activityNote: [''],
    bookingType: [BookingType.Normal, Validators.required],
    executionHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    technicalSupervisionHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    processRelatedHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    projectManagementHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    researchAndDevHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    workshopHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    otherActivitiesHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    internManagementHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    simpleTotalHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    notes: [''],
  });

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => {
      this.syncProjectValidation();
      this.syncWeeklyMode();
      this.computeTotals();
    });

    this.loadProjects();
    this.loadSupervisedInterns();
    this.loadRecentEntries();
  }

  /** Returns true when full project-work form should be shown */
  get isProjectWorkMode(): boolean {
    return this.form.controls.category.value === CategoryWork.Project;
  }

  // ── Multi-project getters ────────────────────────────────────────

  /** Project list filtered by the inline search query */
  get filteredProjectOptions(): Array<{ projectId: string; label: string }> {
    const q = this.projectSearchQuery.trim().toLowerCase();
    if (!q) return this.projectOptions;
    return this.projectOptions.filter(p => p.label.toLowerCase().includes(q));
  }

  /** ID of the project shown in the current pager page */
  get currentProjectId(): string {
    return this.selectedProjectIds[this.currentProjectPage] ?? '';
  }

  /** Label of the project shown in the current pager page */
  get currentProjectLabel(): string {
    const id = this.currentProjectId;
    return this.projectOptions.find(p => p.projectId === id)?.label ?? id;
  }

  /** Total number of selected projects (= number of pager pages) */
  get totalProjectPages(): number {
    return this.selectedProjectIds.length;
  }

  get canGoPrev(): boolean { return this.currentProjectPage > 0; }
  get canGoNext(): boolean { return this.currentProjectPage < this.totalProjectPages - 1; }

  // ────────────────────────────────────────────────────────────────

  get filteredDateModeOptions() {
    const freq = this.form.controls.allocationFrequency.value;
    if (freq === AllocationFrequency.Daily) {
      return this.dateSelectionModeOptions.filter(o => o.value !== DateSelectionMode.WeekRange);
    }
    return this.dateSelectionModeOptions;
  }

  get activeInternOptions(): SupervisedInternOption[] {
    const projectId = this.currentProjectId || this.form.controls.projectId.value;
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

  get monthLoggedHours(): number {
    const dashboardHours = this.monthlyDashboard?.loggedHours;
    if (typeof dashboardHours === 'number' && Number.isFinite(dashboardHours)) {
      return dashboardHours;
    }

    return this.recentEntries.reduce((total, entry) => total + (entry.totalHours ?? this.sumEntryHours(entry)), 0);
  }

  get monthTargetHours(): number {
    return this.monthlyDashboard?.targetHours ?? 160;
  }

  get monthRemainingHours(): number {
    return Math.max(0, this.monthTargetHours - this.monthLoggedHours);
  }

  get monthProgressPercent(): number {
    if (this.monthTargetHours <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (this.monthLoggedHours / this.monthTargetHours) * 100));
  }

  get monthDailyNeeded(): number {
    const workingDaysLeft = this.workingDaysLeftInMonth();
    if (workingDaysLeft <= 0) {
      return 0;
    }

    return Math.max(0, this.monthRemainingHours / workingDaysLeft);
  }

  get monthStatusLabel(): string {
    if (this.monthlyDashboard?.status) {
      return this.monthlyDashboard.status;
    }

    if (this.monthProgressPercent >= 100) {
      return 'Target reached';
    }

    if (this.monthProgressPercent >= 75) {
      return 'Strong pace';
    }

    if (this.monthProgressPercent >= 45) {
      return 'Keep pushing';
    }

    return 'Needs focus';
  }

  get monthStatusIcon(): string {
    if (this.monthProgressPercent >= 100) {
      return 'verified';
    }

    if (this.monthProgressPercent >= 75) {
      return 'trending_up';
    }

    if (this.monthProgressPercent >= 45) {
      return 'speed';
    }

    return 'flag';
  }

  get selectedEntryPreview(): HourEntryDto | null {
    if (!this.editingEntryId) {
      return null;
    }

    return this.recentEntries.find((entry) => entry.id === this.editingEntryId) ?? null;
  }

  get recentProjectCount(): number {
    return this.projectOptions.length;
  }

  get productiveDayCount(): number {
    return new Set(this.recentEntries.map((entry) => entry.date).filter(Boolean)).size;
  }

  get topProjectEntries(): ProjectHourFocus[] {
    const totals = this.recentEntries.reduce<Map<string, ProjectHourFocus>>((accumulator, entry) => {
      const label = entry.projectName || 'Non-project activity';
      const current = accumulator.get(label) ?? { label, hours: 0, entries: 0 };
      current.hours += entry.totalHours ?? this.sumEntryHours(entry);
      current.entries += 1;
      accumulator.set(label, current);
      return accumulator;
    }, new Map<string, ProjectHourFocus>());

    return [...totals.values()].sort((a, b) => b.hours - a.hours).slice(0, 4);
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

    const isProjectWork = this.isProjectWorkMode;
    const activityNote = v.activityNote?.trim() ? v.activityNote.trim() : null;

    // ── Edit mode: single-project update (unchanged behaviour) ───────
    if (this.editingEntryId) {
      const payload: CreateHourEntryDto = {
        projectId: isProjectWork ? v.projectId : null,
        allocationFrequency: v.allocationFrequency,
        dateSelectionMode: v.dateSelectionMode!,
        selectedDates,
        rangeStartDate,
        rangeEndDate,
        category: v.category,
        bookingType: v.bookingType,
        totalHours: isProjectWork ? this.totalHours : v.simpleTotalHours,
        activityNote,
        executionHours: isProjectWork ? v.executionHours : 0,
        technicalSupervisionHours: isProjectWork ? v.technicalSupervisionHours : 0,
        processRelatedHours: isProjectWork ? v.processRelatedHours : 0,
        projectManagementHours: isProjectWork ? v.projectManagementHours : 0,
        researchAndDevHours: isProjectWork ? v.researchAndDevHours : 0,
        workshopHours: isProjectWork ? v.workshopHours : 0,
        otherActivitiesHours: isProjectWork ? v.otherActivitiesHours : 0,
        internManagementHours: isProjectWork ? v.internManagementHours : 0,
        supervisedInterns: isProjectWork
          ? this.selectedInterns
              .filter((intern) => intern.hours > 0)
              .map((intern) => ({ internAllocationId: intern.internAllocationId, hours: intern.hours }))
          : [],
        notes: v.notes?.trim() ? v.notes.trim() : null,
      };

      this.isSubmitting = true;
      this.hours.updateEntry(this.editingEntryId, this.toUpdatePayload(payload))
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
                this.notifications.showError('Unable to update entry.');
                this.cdr.markForCheck();
              });
              return;
            }
            this.zone.run(() => {
              this.notifications.showSuccess('Hours updated successfully.');
              this.resetForm();
              this.loadRecentEntries();
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
      return;
    }

    // ── Create mode: one request per selected project (forkJoin) ────
    const baseHours = {
      allocationFrequency: v.allocationFrequency,
      dateSelectionMode: v.dateSelectionMode!,
      selectedDates,
      rangeStartDate,
      rangeEndDate,
      category: v.category,
      bookingType: v.bookingType,
      totalHours: isProjectWork ? this.totalHours : v.simpleTotalHours,
      activityNote,
      executionHours: isProjectWork ? v.executionHours : 0,
      technicalSupervisionHours: isProjectWork ? v.technicalSupervisionHours : 0,
      processRelatedHours: isProjectWork ? v.processRelatedHours : 0,
      projectManagementHours: isProjectWork ? v.projectManagementHours : 0,
      researchAndDevHours: isProjectWork ? v.researchAndDevHours : 0,
      workshopHours: isProjectWork ? v.workshopHours : 0,
      otherActivitiesHours: isProjectWork ? v.otherActivitiesHours : 0,
      internManagementHours: isProjectWork ? v.internManagementHours : 0,
      supervisedInterns: isProjectWork
        ? this.selectedInterns
            .filter((intern) => intern.hours > 0)
            .map((intern) => ({ internAllocationId: intern.internAllocationId, hours: intern.hours }))
        : [],
      notes: v.notes?.trim() ? v.notes.trim() : null,
    };

    // Build one observable per project; catch errors individually so that a
    // failure on one project does not cancel the others.
    const projectIds = isProjectWork && this.selectedProjectIds.length > 0
      ? this.selectedProjectIds
      : [null]; // non-project activity → single call with no projectId

    const requests$ = projectIds.map((projectId) =>
      this.hours.createEntry({ ...baseHours, projectId }).pipe(
        map(() => ({ projectId, success: true as const, error: null })),
        catchError((err: unknown) =>
          of({ projectId, success: false as const, error: this.extractApiError(err) })
        )
      )
    );

    this.isSubmitting = true;
    forkJoin(requests$)
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.isSubmitting = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe((results) => {
        this.zone.run(() => {
          const successes = results.filter((r) => r.success);
          const failures  = results.filter((r) => !r.success);

          if (successes.length > 0) {
            const n = successes.length;
            this.notifications.showSuccess(
              `${n} entr${n > 1 ? 'ies' : 'y'} saved successfully.`
            );
            this.resetForm();
            this.loadRecentEntries();
          }

          failures.forEach((f) => {
            const label = this.projectOptions.find((p) => p.projectId === f.projectId)?.label
              ?? f.projectId
              ?? 'Activity';
            this.notifications.showError(`${label}: ${f.error}`);
          });

          this.cdr.markForCheck();
        });
      });
  }

  // ── Multi-project selection / pagination ─────────────────────────

  onProjectsSelectionChanged(ids: string[]): void {
    this.selectedProjectIds = ids;
    // Clamp page index so it stays within bounds after removing projects
    this.currentProjectPage = Math.min(this.currentProjectPage, Math.max(0, ids.length - 1));
    // Sync the hidden projectId control with the first selection (for validators)
    const first = ids[0] ?? '';
    this.form.controls.projectId.setValue(first, { emitEvent: false });

    // Reset intern state
    this.selectedInternAllocationId = '';
    this.internDraftHours = 0;
    this.editingInternAllocationId = null;
    this.selectedInterns = this.selectedInterns.filter(
      (intern) => !intern.projectId || ids.includes(intern.projectId)
    );

    this.computeTotals();
    this.cdr.markForCheck();
  }

  goToPrevProject(): void {
    if (this.canGoPrev) {
      this.currentProjectPage -= 1;
      this.cdr.markForCheck();
    }
  }

  goToNextProject(): void {
    if (this.canGoNext) {
      this.currentProjectPage += 1;
      this.cdr.markForCheck();
    }
  }

  // ─────────────────────────────────────────────────────────────────

  /** Clear search filter when the project select panel closes */
  onProjectPanelOpenChanged(opened: boolean): void {
    if (!opened) {
      this.projectSearchQuery = '';
    }
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
      title: 'Remove intern supervision',
      message: `Do you really want to remove supervision hours for ${intern.internName}?`,
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

  editEntry(entry: HourEntryDto): void {
    if (!entry.id) {
      return;
    }

    this.editingEntryId = entry.id;
    this.selectedDatesList = [];
    this.selectedInterns = [];
    this.selectedInternAllocationId = '';
    this.internDraftHours = 0;
    this.editingInternAllocationId = null;

    const entryDate = this.parseDate(entry.date);
    this.form.patchValue({
      projectId: entry.projectId ?? '',
      allocationFrequency: AllocationFrequency.Daily,
      dateSelectionMode: DateSelectionMode.SingleDay,
      date: entryDate,
      selectedDatesText: '',
      rangeStartDate: '',
      rangeEndDate: '',
      category: entry.projectId ? CategoryWork.Project : CategoryWork.Other,
      activityNote: '',
      bookingType: entry.bookingType ?? BookingType.Normal,
      executionHours: entry.executionHours ?? 0,
      technicalSupervisionHours: entry.supervisionHours ?? 0,
      processRelatedHours: entry.processHours ?? 0,
      projectManagementHours: entry.managementHours ?? 0,
      researchAndDevHours: entry.rAndDHours ?? 0,
      workshopHours: entry.workshopHours ?? 0,
      otherActivitiesHours: entry.otherHours ?? 0,
      internManagementHours: entry.internManagementHours ?? 0,
      simpleTotalHours: entry.totalHours ?? 0,
      notes: entry.notes ?? '',
    });

    this.computeTotals();
    this.cdr.markForCheck();

    queueMicrotask(() => {
      document.querySelector('.editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.cdr.markForCheck();
  }

  deleteEntry(entry: HourEntryDto): void {
    if (!entry.id) {
      return;
    }

    const data: ConfirmationDialogData = {
      title: 'Delete entry',
      message: `Do you really want to delete this ${this.formatEntryHours(entry)} entry?`,
      icon: 'delete',
      saveLabel: 'Delete',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== 'save') {
        return;
      }

      this.hours.deleteEntry(entry.id).subscribe({
        next: () => {
          this.notifications.showSuccess('Entry deleted successfully.');
          if (this.editingEntryId === entry.id) {
            this.resetForm();
          }
          this.loadRecentEntries();
        },
        error: (err) => this.notifications.showError(this.extractApiError(err)),
      });
    });
  }

  formatEntryDate(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  formatEntryHours(entry: HourEntryDto): string {
    const hours = entry.totalHours ?? this.sumEntryHours(entry);
    return `${hours.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`;
  }

  getEntryBreakdown(entry: HourEntryDto): string {
    const parts = [
      ['Execution', entry.executionHours],
      ['Supervision', entry.supervisionHours],
      ['Process', entry.processHours],
      ['Management', entry.managementHours],
      ['R&D', entry.rAndDHours],
      ['Workshop', entry.workshopHours],
      ['Other', entry.otherHours],
      ['Interns', entry.internManagementHours],
    ]
      .filter(([, value]) => Number(value) > 0)
      .map(([label, value]) => `${label}: ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}h`);

    return parts.length ? parts.join(' | ') : 'No detailed split';
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

  private loadRecentEntries(): void {
    const today = new Date();
    this.isLoadingRecentEntries = true;
    this.isLoadingMonthlyDashboard = true;
    this.recentEntriesError = '';

    forkJoin({
      // The Entries history is intentionally unfiltered: normal users must see all
      // of their allocations, regardless of the month they were recorded in.
      // The dashboard request below remains monthly so its summary calculations
      // continue to reflect only the current month.
      entries: this.hours.myEntries().pipe(
        catchError(() => {
          this.recentEntriesError = 'Unable to load your recent entries.';
          return of([] as HourEntryDto[]);
        })
      ),
      dashboard: this.hours.dashboardMonthly(today.getFullYear(), today.getMonth() + 1).pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          this.isLoadingRecentEntries = false;
          this.isLoadingMonthlyDashboard = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(({ entries, dashboard }) => {
        this.recentEntries = [...entries].sort((a, b) =>
          String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))
        );
        this.monthlyDashboard = this.mapMonthlyFocus(dashboard);
        this.cdr.markForCheck();
      });
  }

  private validateForm(): boolean {
    // For project-work mode, we validate that at least one project is selected
    // via the multi-select (selectedProjectIds) rather than the hidden form control.
    const hasProjects = this.isProjectWorkMode ? this.selectedProjectIds.length > 0 : true;
    const validBase = this.isProjectWorkMode
      ? !this.form.invalid && hasProjects
      : !this.form.invalid;
    const values = this.form.getRawValue();
    const selectedDates = this.buildSelectedDates(values);
    const validDates = this.hasValidDateSelection(values.dateSelectionMode, selectedDates);

    this.totalOver24 = this.totalHours > 24;

    return validBase && validDates && !this.totalOver24;
  }

  private syncProjectValidation(): void {
    const projectControl = this.form.controls.projectId;

    if (this.isProjectWorkMode) {
      // The multi-select keeps projectId in sync via onProjectsSelectionChanged.
      // Only set required if still empty (nothing selected yet).
      projectControl.setValidators(Validators.required);
    } else {
      projectControl.clearValidators();
      if (projectControl.value) {
        projectControl.setValue('', { emitEvent: false });
      }
      // Also clear multi-select state when switching away from project mode
      this.selectedProjectIds = [];
      this.currentProjectPage = 0;
      if (this.selectedInterns.length || this.selectedInternAllocationId || this.internDraftHours) {
        this.selectedInterns = [];
        this.selectedInternAllocationId = '';
        this.internDraftHours = 0;
        this.editingInternAllocationId = null;
      }
    }

    projectControl.updateValueAndValidity({ emitEvent: false });
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
    return `${year}-${month}-${day}`;
  }

  private toIsoDate(value: Date | string | null | undefined): string {
    if (!value) return '';

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      return this.formatDate(value);
    }

    const raw = value.trim();
    if (!raw) return '';
    const normalized = raw.includes('T') ? raw : `${raw}T00:00:00Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return this.formatDate(date);
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
      return `The request failed with status ${err.status}`;
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
      category: CategoryWork.Project,
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
    this.editingEntryId = null;
    this.totalHours = 0;
    this.overtimeWarning = false;
    this.totalOver24 = false;
    // Reset multi-project state
    this.selectedProjectIds = [];
    this.projectSearchQuery = '';
    this.currentProjectPage = 0;
    this.form.controls.projectId.setValue('', { emitEvent: false });
  }

  private toUpdatePayload(payload: CreateHourEntryDto): HourEntryUpdateDto {
    return {
      bookingType: payload.bookingType,
      executionHours: payload.executionHours,
      supervisionHours: payload.technicalSupervisionHours,
      processHours: payload.processRelatedHours,
      managementHours: payload.projectManagementHours,
      rAndDHours: payload.researchAndDevHours,
      workshopHours: payload.workshopHours,
      otherHours: this.isProjectWorkMode ? payload.otherActivitiesHours : (payload.totalHours ?? 0),
      notes: payload.notes,
    };
  }

  private parseDate(value?: string): Date {
    if (!value) {
      return new Date();
    }

    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private sumEntryHours(entry: HourEntryDto): number {
    return [
      entry.executionHours,
      entry.supervisionHours,
      entry.processHours,
      entry.managementHours,
      entry.rAndDHours,
      entry.workshopHours,
      entry.otherHours,
      entry.internManagementHours,
    ].reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
  }

  private mapMonthlyFocus(source: unknown): HourEntryMonthlyFocus | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const record = source as Record<string, unknown>;
    return {
      loggedHours: this.pickNumber(record, ['loggedHours', 'LoggedHours', 'totalHours', 'TotalHours']),
      targetHours: this.pickNumber(record, ['targetHours', 'TargetHours', 'monthlyTargetHours', 'MonthlyTargetHours']),
      dailyNeeded: this.pickNumber(record, ['dailyNeeded', 'DailyNeeded']),
      status: this.pickText(record, ['status', 'Status', 'performanceStatus', 'PerformanceStatus']),
    };
  }

  private pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const parsed = this.toNullableNumber(record[key]);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  private pickText(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private workingDaysLeftInMonth(): number {
    const today = new Date();
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    let count = 0;

    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
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

interface HourEntryMonthlyFocus {
  loggedHours: number | null;
  targetHours: number | null;
  dailyNeeded: number | null;
  status: string | null;
}

interface ProjectHourFocus {
  label: string;
  hours: number;
  entries: number;
}
