import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import {
  AdminTargetSettingsApiService,
  CompanyTargetSettings,
  KpiTargetSetting,
  KpiTargetSettingPayload,
} from '../../../../core/services/admin-target-settings-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  ConfirmationDialog,
  ConfirmationDialogData,
} from '../../../../shared/components/confirmation-dialog/confirmation-dialog';

type CompanyFormShape = {
  hoursPerDay: FormControl<number>;
  annualHoursTarget: FormControl<number>;
  workingDaysPerMonth: FormControl<number>;
  fiscalYearStartMonth: FormControl<number>;
};

type KpiFormShape = {
  name: FormControl<string>;
  description: FormControl<string>;
  targetValue: FormControl<number>;
  displayOrder: FormControl<number>;
  isActive: FormControl<boolean>;
};

@Component({
  selector: 'app-target-settings',
  standalone: false,
  templateUrl: './target-settings.html',
  styleUrl: './target-settings.scss',
})
export class TargetSettingsPage implements OnInit {
  private readonly api = inject(AdminTargetSettingsApiService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  companySettings: CompanyTargetSettings | null = null;
  kpis: KpiTargetSetting[] = [];
  filteredKpis: KpiTargetSetting[] = [];
  searchTerm = '';

  isLoading = false;
  isRefreshing = false;
  isSavingCompany = false;
  savingKpi = false;
  deletingId: string | null = null;
  errorMessage = '';

  isDrawerOpen = false;
  editingKpiId: string | null = null;

  readonly companyForm = new FormGroup<CompanyFormShape>({
    hoursPerDay: new FormControl(8, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01), Validators.max(24)],
    }),
    annualHoursTarget: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    workingDaysPerMonth: new FormControl(22, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(31)],
    }),
    fiscalYearStartMonth: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(12)],
    }),
  });

  readonly kpiForm = new FormGroup<KpiFormShape>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    targetValue: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01), Validators.max(100000)],
    }),
    displayOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(999)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.isLoading = true;
    this.isRefreshing = true;
    this.errorMessage = '';

    this.api.getCompanySettings().subscribe({
      next: (settings) => {
        this.zone.run(() => {
          this.companySettings = settings;
          this.companyForm.reset({
            hoursPerDay: settings.hoursPerDay,
            annualHoursTarget: settings.annualHoursTarget,
            workingDaysPerMonth: settings.workingDaysPerMonth,
            fiscalYearStartMonth: settings.fiscalYearStartMonth,
          });
          this.loadKpis();
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.isLoading = false;
          this.isRefreshing = false;
          this.errorMessage = err?.message || 'Unable to load target settings.';
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadKpis(): void {
    this.api.getKpis(true).subscribe({
      next: (items) => {
        this.zone.run(() => {
          this.kpis = [...(items ?? [])].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
          this.applyFilter();
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.kpis = [];
          this.filteredKpis = [];
          this.isLoading = false;
          this.isRefreshing = false;
          this.errorMessage = err?.message || 'Unable to load KPI targets.';
          this.cdr.markForCheck();
        });
      },
    });
  }

  saveCompany(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isSavingCompany = true;
    this.api.updateCompanySettings(this.companyForm.getRawValue()).subscribe({
      next: (settings) => {
        this.zone.run(() => {
          this.companySettings = settings;
          this.notifications.showSuccess('Company targets updated');
          this.isSavingCompany = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to save company targets');
          this.isSavingCompany = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const sorted = [...this.kpis].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    this.filteredKpis = term
      ? sorted.filter((kpi) => `${kpi.name} ${kpi.description ?? ''}`.toLowerCase().includes(term))
      : sorted;
  }

  openCreate(): void {
    this.editingKpiId = null;
    this.kpiForm.reset({
      name: '',
      description: '',
      targetValue: 0,
      displayOrder: this.nextDisplayOrder,
      isActive: true,
    });
    this.isDrawerOpen = true;
  }

  openEdit(kpi: KpiTargetSetting): void {
    this.editingKpiId = kpi.id;
    this.kpiForm.reset({
      name: kpi.name,
      description: kpi.description ?? '',
      targetValue: kpi.targetValue,
      displayOrder: kpi.displayOrder,
      isActive: kpi.isActive,
    });
    this.isDrawerOpen = true;
  }

  closeDrawer(): void {
    if (this.savingKpi) {
      return;
    }
    this.isDrawerOpen = false;
  }

  saveKpi(): void {
    if (this.kpiForm.invalid) {
      this.kpiForm.markAllAsTouched();
      return;
    }

    const payload: KpiTargetSettingPayload = {
      name: this.kpiForm.controls.name.value.trim(),
      description: this.kpiForm.controls.description.value.trim() || undefined,
      targetValue: Number(this.kpiForm.controls.targetValue.value),
      displayOrder: Number(this.kpiForm.controls.displayOrder.value),
      isActive: this.kpiForm.controls.isActive.value,
    };

    this.savingKpi = true;
    const request$ = this.editingKpiId
      ? this.api.updateKpi(this.editingKpiId, payload)
      : this.api.createKpi(payload);

    request$.subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess(this.editingKpiId ? 'KPI target updated' : 'KPI target created');
          this.savingKpi = false;
          this.isDrawerOpen = false;
          this.cdr.markForCheck();
          this.loadKpis();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to save KPI target');
          this.savingKpi = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  delete(kpi: KpiTargetSetting): void {
    const data: ConfirmationDialogData = {
      title: 'Delete KPI Target',
      message: `Are you sure you want to delete "${kpi.name}"? New projects will no longer receive this KPI by default.`,
      icon: 'track_changes',
      saveLabel: 'Delete Permanently',
      saveColor: 'warn',
      cancelLabel: 'Cancel',
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'save') {
        this.executeDelete(kpi.id);
      }
    });
  }

  private executeDelete(id: string): void {
    this.deletingId = id;
    this.api.deleteKpi(id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess('KPI target deleted');
          this.deletingId = null;
          this.cdr.markForCheck();
          this.loadKpis();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to delete KPI target');
          this.deletingId = null;
          this.cdr.markForCheck();
        });
      },
    });
  }

  trackByKpiId = (_: number, kpi: KpiTargetSetting): string => kpi.id;

  get activeKpisCount(): number {
    return this.kpis.filter((kpi) => kpi.isActive).length;
  }

  get inactiveKpisCount(): number {
    return this.kpis.length - this.activeKpisCount;
  }

  get nextDisplayOrder(): number {
    return this.kpis.length ? Math.max(...this.kpis.map((kpi) => kpi.displayOrder || 0)) + 1 : 1;
  }

  get fiscalYearStartLabel(): string {
    const month = Number(this.companyForm.controls.fiscalYearStartMonth.value);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return '-';
    }

    return new Date(2000, month - 1, 1).toLocaleString(undefined, { month: 'short' });
  }

  get hasKpis(): boolean {
    return this.kpis.length > 0;
  }

  get hasFilteredKpis(): boolean {
    return this.filteredKpis.length > 0;
  }
}
