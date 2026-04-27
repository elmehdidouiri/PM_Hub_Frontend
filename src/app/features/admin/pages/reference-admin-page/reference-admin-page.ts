import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, map } from 'rxjs';

import { NotificationService } from '../../../../core/services/notification.service';
import { BusinessUnitsApiService } from '../../../../core/services/business-units-api.service';
import { DepartmentsApiService } from '../../../../core/services/departments-api.service';
import { PlantsApiService } from '../../../../core/services/plants-api.service';
import { TechnologiesApiService } from '../../../../core/services/technologies-api.service';
import { SolutionDomainsApiService } from '../../../../core/services/solution-domains-api.service';
import { ReferenceItem } from '../../../../core/models';
import { SelectOption } from '../../../projects/models/project.models';

type EntityKey =
  | 'business-units'
  | 'departments'
  | 'plants'
  | 'technologies'
  | 'solution-domains';

type ReferenceFormShape = {
  name: FormControl<string>;
  description: FormControl<string>;
  businessUnitId: FormControl<string>;
  plantId: FormControl<string>;
};

@Component({
  selector: 'app-reference-admin-page',
  standalone: false,
  templateUrl: './reference-admin-page.html',
  styleUrl: './reference-admin-page.scss',
})
export class ReferenceAdminPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subscriptions = new Subscription();

  private readonly businessUnitsApi = inject(BusinessUnitsApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly plantsApi = inject(PlantsApiService);
  private readonly technologiesApi = inject(TechnologiesApiService);
  private readonly solutionDomainsApi = inject(SolutionDomainsApiService);

  entity!: EntityKey;
  title = 'Reference';
  apiPath = '';

  businessUnits: SelectOption[] = [];
  plants: SelectOption[] = [];
  isPlantsLoading = false;
  private businessUnitNameById = new Map<string, string>();
  private plantNameById = new Map<string, string>();

  items: Array<
    ReferenceItem & {
      businessUnitId?: string;
      businessUnitName?: string;
      plantId?: string;
      plantName?: string;
    }
  > = [];
  filteredItems: Array<
    ReferenceItem & {
      businessUnitId?: string;
      businessUnitName?: string;
      plantId?: string;
      plantName?: string;
    }
  > = [];
  searchTerm = '';

  isLoading = false;
  isRefreshing = false;
  errorMessage = '';

  isDrawerOpen = false;
  editingId: string | null = null;
  saving = false;
  deletingId: string | null = null;

  readonly form = new FormGroup<ReferenceFormShape>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    description: new FormControl('', { nonNullable: true }),
    businessUnitId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    plantId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.entity = (this.route.snapshot.data['entity'] as EntityKey) || 'business-units';
    this.configureEntity(this.entity);
    this.loadReferenceSelectors();
    this.configureValidators();
    this.refresh();

    // Robust: ensure we fetch plants whenever BU changes (departments only).
    if (this.requiresPlant || this.requiresBusinessUnit) {
      this.subscriptions.add(
        this.form.controls.businessUnitId.valueChanges.subscribe((value) => {
          if (!this.requiresPlant) {
            return;
          }

          const businessUnitId = (value || '').trim();
          this.form.controls.plantId.setValue('');
          this.plants = [];

          if (this.requiresPlant) {
            this.form.controls.plantId.disable({ emitEvent: false });
          }

          if (!businessUnitId) {
            this.cdr.markForCheck();
            return;
          }

          this.loadPlantsForBusinessUnit(businessUnitId);
        })
      );
    }

    if (this.requiresPlant) {
      this.form.controls.plantId.disable({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private configureValidators(): void {
    if (this.requiresDescription) {
      this.form.controls.description.setValidators([Validators.required, Validators.minLength(2)]);
      this.form.controls.description.updateValueAndValidity({ emitEvent: false });
    } else {
      this.form.controls.description.clearValidators();
      this.form.controls.description.setValue('');
      this.form.controls.description.updateValueAndValidity({ emitEvent: false });
    }

    if (!this.requiresBusinessUnit) {
      this.form.controls.businessUnitId.clearValidators();
      this.form.controls.businessUnitId.setValue('');
      this.form.controls.businessUnitId.updateValueAndValidity({ emitEvent: false });
    }

    if (!this.requiresPlant) {
      this.form.controls.plantId.clearValidators();
      this.form.controls.plantId.setValue('');
      this.form.controls.plantId.updateValueAndValidity({ emitEvent: false });
    }
  }

  private configureEntity(entity: EntityKey): void {
    if (entity === 'business-units') {
      this.title = 'Business Units';
      this.apiPath = '/api/businessunits';
      return;
    }
    if (entity === 'departments') {
      this.title = 'Departments';
      this.apiPath = '/api/departments';
      return;
    }
    if (entity === 'plants') {
      this.title = 'Plants';
      this.apiPath = '/api/plants';
      return;
    }
    if (entity === 'technologies') {
      this.title = 'Technologies';
      this.apiPath = '/api/technologies';
      return;
    }
    this.title = 'Solution Domains';
    this.apiPath = '/api/solutiondomains';
  }

  refresh(): void {
    this.isRefreshing = true;
    this.isLoading = true;
    this.errorMessage = '';

    this.getListRequest().subscribe({
      next: (items) => {
        this.zone.run(() => {
          this.items = items ?? [];
          this.enrichDisplayNames();
          this.applyFilter();
          this.isRefreshing = false;
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.items = [];
          this.filteredItems = [];
          this.isRefreshing = false;
          this.isLoading = false;
          this.errorMessage = err?.message || 'Unable to load data';
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
    if (!term) {
      this.filteredItems = [...this.items];
      return;
    }

    this.filteredItems = this.items.filter((item) => {
      const haystack = `${item.name} ${item.description ?? ''} ${item.id}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ name: '', description: '', businessUnitId: '', plantId: '' });
    this.isDrawerOpen = true;
    if (this.requiresPlant) {
      this.form.controls.plantId.disable({ emitEvent: false });
    }
  }

  openEdit(item: ReferenceItem): void {
    this.editingId = item.id;
    const businessUnitId = (item as any).businessUnitId || '';
    const plantId = (item as any).plantId || '';
    this.form.reset({ name: item.name ?? '', description: item.description ?? '', businessUnitId, plantId: plantId || '' });
    this.isDrawerOpen = true;

    if (this.requiresBusinessUnit && businessUnitId) {
      // Load plant options for the selected BU, then set plantId (departments only).
      this.loadPlantsForBusinessUnit(businessUnitId, plantId);
    }

    if (this.requiresPlant) {
      // Will be enabled once plants are loaded.
      this.form.controls.plantId.disable({ emitEvent: false });
    }
  }

  closeDrawer(): void {
    if (this.saving) return;
    this.isDrawerOpen = false;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value.trim();
    const description = this.form.controls.description.value.trim();
    const businessUnitId = this.form.controls.businessUnitId.value;
    const plantId = this.form.controls.plantId.value;

    this.saving = true;
    const request$ = this.editingId
      ? this.getUpdateRequest(this.editingId, { name, description, businessUnitId, plantId })
      : this.getCreateRequest({ name, description, businessUnitId, plantId });

    request$.subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess(this.editingId ? 'Updated successfully' : 'Created successfully');
          this.saving = false;
          this.isDrawerOpen = false;
          this.cdr.markForCheck();
          this.refresh();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to save');
          this.saving = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  delete(item: ReferenceItem): void {
    this.deletingId = item.id;
    this.getDeleteRequest(item.id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.notifications.showSuccess('Deleted successfully');
          this.deletingId = null;
          this.cdr.markForCheck();
          this.refresh();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.notifications.showError('Unable to delete');
          this.deletingId = null;
          this.cdr.markForCheck();
        });
      },
    });
  }

  trackById = (_: number, item: ReferenceItem): string => item.id;

  get hasItems(): boolean {
    return this.items.length > 0;
  }

  get hasFilteredItems(): boolean {
    return this.filteredItems.length > 0;
  }

  private getListRequest() {
    if (this.entity === 'business-units') return this.businessUnitsApi.listItems();
    if (this.entity === 'departments')
      return this.departmentsApi.listDepartments().pipe(
        map((items) =>
          (items ?? []).map((dto) => ({
            id: dto.id,
            name: dto.name,
            businessUnitId: dto.businessUnitId,
            businessUnitName: dto.businessUnitName || '',
            plantId: dto.plantId,
            plantName: dto.plantName || '',
            description: [dto.businessUnitName, dto.plantName].filter(Boolean).join(' • ') || undefined,
          }))
        )
      );
    if (this.entity === 'plants')
      return this.plantsApi.listPlants().pipe(
        map((items) =>
          (items ?? []).map((dto) => ({
            id: dto.id,
            name: dto.name,
            description: dto.description || undefined,
          }))
        )
      );
    if (this.entity === 'technologies') return this.technologiesApi.listItems();
    return this.solutionDomainsApi.listItems();
  }

  private getCreateRequest(payload: { name: string; description: string; businessUnitId: string; plantId: string }) {
    if (this.entity === 'business-units') return this.businessUnitsApi.createItem({ name: payload.name, description: payload.description });
    if (this.entity === 'departments')
      return this.departmentsApi.createItem({ name: payload.name, businessUnitId: payload.businessUnitId, plantId: payload.plantId });
    if (this.entity === 'plants') return this.plantsApi.createItem({ name: payload.name, description: payload.description });
    if (this.entity === 'technologies') return this.technologiesApi.createItem({ name: payload.name, description: payload.description });
    return this.solutionDomainsApi.createItem({ name: payload.name, description: payload.description });
  }

  private getUpdateRequest(id: string, payload: { name: string; description: string; businessUnitId: string; plantId: string }) {
    if (this.entity === 'business-units') return this.businessUnitsApi.updateItem(id, { name: payload.name, description: payload.description });
    if (this.entity === 'departments')
      return this.departmentsApi.updateItem(id, { name: payload.name, businessUnitId: payload.businessUnitId, plantId: payload.plantId });
    if (this.entity === 'plants') return this.plantsApi.updateItem(id, { name: payload.name, description: payload.description });
    if (this.entity === 'technologies') return this.technologiesApi.updateItem(id, { name: payload.name, description: payload.description });
    return this.solutionDomainsApi.updateItem(id, { name: payload.name, description: payload.description });
  }

  private getDeleteRequest(id: string) {
    if (this.entity === 'business-units') return this.businessUnitsApi.delete(id);
    if (this.entity === 'departments') return this.departmentsApi.delete(id);
    if (this.entity === 'plants') return this.plantsApi.delete(id);
    if (this.entity === 'technologies') return this.technologiesApi.delete(id);
    return this.solutionDomainsApi.delete(id);
  }

  get requiresDescription(): boolean {
    return this.entity === 'business-units' || this.entity === 'plants' || this.entity === 'technologies' || this.entity === 'solution-domains';
  }

  get requiresBusinessUnit(): boolean {
    return this.entity === 'departments';
  }

  get requiresPlant(): boolean {
    return this.entity === 'departments';
  }

  get showBusinessUnitColumn(): boolean {
    return this.entity === 'departments';
  }

  get showPlantColumn(): boolean {
    return this.entity === 'departments';
  }

  onBusinessUnitChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.form.controls.businessUnitId.setValue(value);

    // Changing BU invalidates plant selection for departments.
    this.form.controls.plantId.setValue('');
    this.plants = [];
    if (this.requiresPlant) {
      this.form.controls.plantId.disable({ emitEvent: false });
    }

    if (!value) {
      return;
    }
    this.loadPlantsForBusinessUnit(value);
  }

  private loadPlantsForBusinessUnit(businessUnitId: string, selectedPlantId?: string): void {
    this.isPlantsLoading = true;
    if (this.requiresPlant) {
      this.form.controls.plantId.disable({ emitEvent: false });
    }
    this.plantsApi.listPlantsByBusinessUnit(businessUnitId).subscribe({
      next: (items) => {
        this.zone.run(() => {
          this.plants = (items ?? [])
            .map((dto) => ({ id: dto.id, label: (dto.name || '').trim() || dto.id || 'Plant' }))
            .filter((x) => !!x.id);
          this.isPlantsLoading = false;
          if (selectedPlantId) {
            this.form.controls.plantId.setValue(selectedPlantId);
          }
          if (this.requiresPlant) {
            this.form.controls.plantId.enable({ emitEvent: false });
          }
          if (!this.plants.length) {
            this.notifications.showInfo('No plants found for the selected business unit');
          }
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.plants = [];
          this.isPlantsLoading = false;
          if (this.requiresPlant) {
            this.form.controls.plantId.enable({ emitEvent: false });
          }
          this.notifications.showError(err?.message || 'Unable to load plants for this business unit');
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadReferenceSelectors(): void {
    // Dropdown sources:
    // - Departments: needs business units + plants
    // - Plants: no extra selectors needed (name + description)
    if (this.entity !== 'departments') {
      return;
    }

    this.businessUnitsApi.listItems().subscribe({
      next: (items) => {
        this.zone.run(() => {
          this.businessUnits = (items ?? []).map((item) => ({ id: item.id, label: item.name }));
          this.businessUnitNameById = new Map(this.businessUnits.map((bu) => [bu.id, bu.label]));
          this.enrichDisplayNames();
          this.applyFilter();
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.businessUnits = [];
          this.businessUnitNameById = new Map();
          this.enrichDisplayNames();
          this.applyFilter();
          this.cdr.markForCheck();
        });
      },
    });

    this.plantsApi.listPlants().subscribe({
      next: (items) => {
        this.zone.run(() => {
          this.plantNameById = new Map((items ?? []).map((p) => [p.id, p.name]));
          this.enrichDisplayNames();
          this.applyFilter();
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.plantNameById = new Map();
          this.enrichDisplayNames();
          this.applyFilter();
          this.cdr.markForCheck();
        });
      },
    });
  }

  private enrichDisplayNames(): void {
    if (this.entity === 'departments') {
      this.items = this.items.map((item) => {
        const businessUnitName =
          (item.businessUnitName || '').trim() ||
          this.businessUnitNameById.get(item.businessUnitId || '') ||
          '';
        const plantName =
          (item.plantName || '').trim() ||
          this.plantNameById.get(item.plantId || '') ||
          '';

        return {
          ...item,
          businessUnitName,
          plantName,
          description:
            item.description ||
            [businessUnitName, plantName].filter(Boolean).join(' • ') ||
            undefined,
        };
      });
      return;
    }

    if (this.entity === 'plants') {
      this.items = this.items.map((item) => {
        const businessUnitName =
          (item.businessUnitName || '').trim() ||
          this.businessUnitNameById.get(item.businessUnitId || '') ||
          '';
        return {
          ...item,
          businessUnitName,
          description: item.description || businessUnitName || undefined,
        };
      });
    }
  }
}

