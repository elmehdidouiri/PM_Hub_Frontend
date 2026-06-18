import { Injectable } from '@angular/core';
import { DashboardFilterParams, ProjectSummaryDto } from '../../projects/models';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardFilterState {
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedYtd: boolean;
  selectedStartDate: string | null;
  selectedEndDate: string | null;
  selectedRoleId: string;
  selectedProjectStatus: string;
  selectedProjectPhase: string;
  selectedProcessStatus: string;
  selectedProjectManagementType: string;
  selectedDepartment: string;
  selectedBusinessUnit: string;
  selectedPlant: string;
}

export interface FilterTicket {
  id: string;
  label: string;
  count: number;
  projects?: ProjectSummaryDto[];
}

export interface StatusMeta {
  id: string;
  label: string;
  apiValue?: string;
}

/**
 * DashboardFilterService – Phase 3 SOLID refactor (SRP / OCP).
 *
 * Responsibility: all filter-building and filter-state logic for the dashboard.
 * Extracted from DashboardHome to give the component a single responsibility:
 * template orchestration.
 *
 * Open/Closed: add a new filter dimension by extending PROJECT_PHASE_MAP or
 * PROCESS_STATUS_MAP constants – no changes to the caller required.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFilterService {

  // ─── Configurable lookup maps (OCP – extend, don't modify) ───────────────

  static readonly PROJECT_STATUS_OPTIONS: StatusMeta[] = [
    { id: 'all',     label: 'All Statuses' },
    { id: 'ongoing', label: 'Ongoing',  apiValue: 'Ongoing' },
    { id: 'onhold',  label: 'On Hold',  apiValue: 'OnHold' },
    { id: 'done',    label: 'Done',     apiValue: 'Done' },
    { id: 'planned', label: 'Planned',  apiValue: 'Planned' },
  ];

  static readonly PROJECT_PHASE_OPTIONS = [
    { id: 'all',           label: 'All phases' },
    { id: 'pipeline',      label: 'Pipeline' },
    { id: 'preprocess',    label: 'Pre Process' },
    { id: 'initiation',    label: 'Initiation' },
    { id: 'planification', label: 'Planification' },
    { id: 'execution',     label: 'Execution' },
    { id: 'monitoring',    label: 'Monitoring' },
    { id: 'closing',       label: 'Closing' },
  ];

  static readonly PROCESS_STATUS_OPTIONS = [
    { id: 'all',         label: 'All process statuses' },
    { id: 'notstarted',  label: 'Not Started' },
    { id: 'asis',        label: 'As-Is Process Understanding' },
    { id: 'tobe',        label: 'To-Be Process Definition' },
    { id: 'onhold',      label: 'On Hold' },
    { id: 'completed',   label: 'Completed' },
    { id: 'implemented', label: 'Implemented In PDM Link' },
    { id: 'cancelled',   label: 'Cancelled' },
  ];

  static readonly PROJECT_MANAGEMENT_TYPE_OPTIONS = [
    { id: 'all', label: 'All project management' },
    { id: 'DigitalOperation', label: 'Digital Operation' },
    { id: 'DigitalSolution', label: 'Digital Solution' },
    { id: 'Infrastructure', label: 'Infrastructure' },
    { id: 'ProcessSimplification', label: 'Process Simplification' },
  ];

  private static readonly PROJECT_PHASE_MAP: Record<string, string> = {
    pipeline: 'Pipeline', preprocess: 'PreProcess', initiation: 'Initiation',
    planification: 'Planification', execution: 'Execution',
    monitoring: 'Monitoring', closing: 'Closing',
  };

  private static readonly PROCESS_STATUS_MAP: Record<string, string> = {
    notstarted: 'NotStarted', asis: 'AsIs', tobe: 'ToBe',
    onhold: 'OnHold', completed: 'Completed',
    implemented: 'Implemented', cancelled: 'Cancelled',
  };

  // ─── Filter building ──────────────────────────────────────────────────────

  buildParams(state: DashboardFilterState): DashboardFilterParams {
    return {
      year:           state.selectedYear ?? undefined,
      month:          !state.selectedYtd ? state.selectedMonth ?? undefined : undefined,
      startDate:      !state.selectedYtd ? state.selectedStartDate ?? undefined : undefined,
      endDate:        !state.selectedYtd ? state.selectedEndDate ?? undefined : undefined,
      roleId:         state.selectedRoleId !== 'all' ? state.selectedRoleId : undefined,
      departmentId:   state.selectedDepartment !== 'all' ? state.selectedDepartment : undefined,
      businessUnitId: state.selectedBusinessUnit !== 'all' ? state.selectedBusinessUnit : undefined,
      plantId:        state.selectedPlant !== 'all' ? state.selectedPlant : undefined,
      projectStatus:  state.selectedProjectStatus !== 'all'
        ? this.toProjectStatusApiValue(state.selectedProjectStatus) : undefined,
      projectPhase:   state.selectedProjectPhase !== 'all'
        ? DashboardFilterService.PROJECT_PHASE_MAP[state.selectedProjectPhase] : undefined,
      processStatus:  state.selectedProcessStatus !== 'all'
        ? DashboardFilterService.PROCESS_STATUS_MAP[state.selectedProcessStatus] : undefined,
      projectManagementType: state.selectedProjectManagementType !== 'all'
        ? state.selectedProjectManagementType : undefined,
      ytd: state.selectedYtd ? true : undefined,
    };
  }

  hasAnyFilterSelected(state: DashboardFilterState): boolean {
    return (
      state.selectedYear !== null ||
      state.selectedMonth !== null ||
      state.selectedYtd ||
      state.selectedRoleId !== 'all' ||
      state.selectedBusinessUnit !== 'all' ||
      state.selectedPlant !== 'all' ||
      state.selectedProjectStatus !== 'all' ||
      state.selectedProjectPhase !== 'all' ||
      state.selectedProcessStatus !== 'all' ||
      state.selectedProjectManagementType !== 'all' ||
      state.selectedDepartment !== 'all'
    );
  }

  activeFilterCount(state: DashboardFilterState): number {
    return [
      state.selectedBusinessUnit !== 'all',
      state.selectedDepartment !== 'all',
      state.selectedProjectPhase !== 'all',
      state.selectedProjectStatus !== 'all',
      state.selectedProjectManagementType !== 'all',
      state.selectedYear !== null,
      state.selectedMonth !== null,
      state.selectedYtd,
    ].filter(Boolean).length;
  }

  // ─── Ticket builders ──────────────────────────────────────────────────────

  buildDepartmentTickets(
    projects: any[],
    departmentIdByName: Map<string, string>,
  ): FilterTicket[] {
    const stats = new Map<string, { label: string; count: number }>();
    departmentIdByName.forEach((id, name) => stats.set(id, { label: name, count: 0 }));
    for (const p of projects) {
      const label = `${p.departmentName ?? p.DepartmentName ?? p.department ?? p.Department ?? 'Unknown'}`.trim();
      const id = p.departmentId ?? p.DepartmentId ?? departmentIdByName.get(label) ?? label;
      const current = stats.get(id) || { label, count: 0 };
      current.count++;
      stats.set(id, current);
    }
    return [...stats.entries()]
      .map(([id, info]) => ({ id, label: info.label, count: info.count }))
      .filter((t) => t.label && t.label.trim() !== '-')
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  buildBusinessUnitTickets(
    projects: any[],
    businessUnitIdByName: Map<string, string>,
  ): FilterTicket[] {
    const stats = new Map<string, { label: string; count: number }>();
    businessUnitIdByName.forEach((id, name) => stats.set(id, { label: name, count: 0 }));
    for (const project of projects) {
      const rawUnits = project.businessUnits ?? project.BusinessUnits ?? project.businessUnitNames ?? project.BusinessUnitNames;
      const rawIds = project.businessUnitIds ?? project.BusinessUnitIds;
      const units = this.toBusinessUnitLabels(rawUnits);
      const ids = this.toStringArray(rawIds);
      if (units.length > 0) {
        units.forEach((unit, index) => {
          const label = `${unit}`.trim();
          if (!label) return;
          const id = ids[index] || businessUnitIdByName.get(label) || label;
          const current = stats.get(id) || { label, count: 0 };
          current.count++;
          stats.set(id, current);
        });
      } else {
        const label = `${project.businessUnitName ?? project.BusinessUnitName ?? project.businessUnit ?? project.BusinessUnit ?? ''}`.trim();
        const id = project.businessUnitId ?? project.BusinessUnitId ?? (label ? businessUnitIdByName.get(label) : null);
        if (id) {
          const current = stats.get(id) || { label: label || id, count: 0 };
          current.count++;
          stats.set(id, current);
        }
      }
    }
    return [...stats.entries()]
      .map(([id, info]) => ({ id, label: info.label, count: info.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 50);
  }

  buildPlantTickets(
    projects: any[],
    plantIdByName: Map<string, string>,
  ): FilterTicket[] {
    const stats = new Map<string, { label: string; count: number }>();
    plantIdByName.forEach((id, name) => stats.set(id, { label: name, count: 0 }));

    for (const p of projects) {
      const label = `${p.plantName ?? p.PlantName ?? p.plant ?? p.Plant ?? ''}`.trim();
      if (!label) continue;
      const id = (p.plantId ?? p.PlantId ?? plantIdByName.get(label)) || label;
      const current = stats.get(id) || { label, count: 0 };
      current.count++;
      stats.set(id, current);
    }
    
    return [...stats.entries()]
      .map(([id, info]) => ({ id, label: info.label, count: info.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 50);
  }

  buildStatusTickets(projects: any[]): FilterTicket[] {
    const statusOptions = DashboardFilterService.PROJECT_STATUS_OPTIONS;
    const counts = new Map<string, number>();
    for (const p of projects) {
      const normalized = this.normalizeProjectStatusId(p.status ?? p.Status ?? p.projectStatus ?? p.ProjectStatus ?? p.statusLabel ?? '');
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    const dynamicTickets = statusOptions
      .filter((s) => s.id !== 'all')
      .map((s) => ({ id: s.id, label: s.label, count: counts.get(s.id) ?? 0 }))
      .filter((s) => s.count > 0 || (s.id !== 'cancelled' && s.id !== 'pipeline'));

    return [
      { id: 'all', label: 'All Statuses', count: projects.length },
      ...dynamicTickets,
    ];
  }

  buildPhaseTickets(projects: any[]): FilterTicket[] {
    const phaseOptions = DashboardFilterService.PROJECT_PHASE_OPTIONS;
    const counts = new Map<string, number>();
    for (const p of projects) {
      const phase = this.normalizeProjectPhaseId(p.phaseLabel ?? p.PhaseLabel ?? p.phase ?? p.Phase ?? '');
      if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1);
    }
    const dynamicTickets = phaseOptions
      .filter((s) => s.id !== 'all')
      .map((s) => ({ 
        id: s.id, 
        label: s.label, 
        count: counts.get(s.id) ?? counts.get(this.normalizeProjectPhaseId(s.label)) ?? 0 
      }));

    return [
      { id: 'all', label: 'All Phases', count: projects.length },
      ...dynamicTickets,
    ];
  }

  buildYearTickets(projects: any[]): FilterTicket[] {
    const counts = new Map<number, number>();
    for (const p of projects) {
      const year = p.year || (p.createdAt ? new Date(p.createdAt).getFullYear() : new Date().getFullYear());
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([year, count]) => ({ id: year.toString(), label: year.toString(), count }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }

  buildProjectManagementTypeTickets(projects: any[]): FilterTicket[] {
    const counts = new Map<string, number>();
    
    const typeMap: Record<string, string> = {
      '0': 'DigitalOperation',
      '1': 'DigitalSolution',
      '2': 'Infrastructure',
      '3': 'ProcessSimplification'
    };

    for (const project of projects) {
      const raw = project.projectManagementType ?? project.ProjectManagementType;
      if (raw === undefined || raw === null || raw === '') {
        continue;
      }
      const rawId = String(raw).trim();
      const id = typeMap[rawId] ?? rawId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return [
      { id: 'all', label: 'All project management', count: projects.length },
      ...DashboardFilterService.PROJECT_MANAGEMENT_TYPE_OPTIONS
        .filter((option) => option.id !== 'all')
        .map((option) => ({ ...option, count: counts.get(option.id) ?? 0 })),
    ];
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => `${item}`.trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
    }

    return [];
  }

  private toBusinessUnitLabels(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return this.toStringArray(value);
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          return `${row['name'] ?? row['label'] ?? row['businessUnitName'] ?? row['BusinessUnitName'] ?? ''}`.trim();
        }
        return '';
      })
      .filter(Boolean);
  }

  // ─── Status helpers ───────────────────────────────────────────────────────

  normalizeProjectStatusId(rawStatus: unknown): string {
    const value = `${rawStatus ?? ''}`.trim().toLowerCase();
    if (!value) return '';
    if (value === '0' || value.includes('ongoing') || value.includes('in progress')) return 'ongoing';
    if (value === '1' || value.includes('on hold') || value.includes('onhold')) return 'onhold';
    if (value === '2' || value.includes('done') || value.includes('complete')) return 'done';
    if (value === '3' || value.includes('planned') || value.includes('plan')) return 'planned';
    return value.replace(/[\s_-]+/g, '');
  }

  normalizeProjectPhaseId(rawPhase: unknown): string {
    const value = `${rawPhase ?? ''}`.trim().toLowerCase();
    if (!value) return '';
    if (value === '0' || value.includes('pipeline')) return 'pipeline';
    if (value === '1' || value.includes('pre process') || value.includes('preprocess')) return 'preprocess';
    if (value === '2' || value.includes('initiation')) return 'initiation';
    if (value === '3' || value.includes('planification') || value.includes('planning')) return 'planification';
    if (value === '4' || value.includes('execution')) return 'execution';
    if (value === '5' || value.includes('monitoring')) return 'monitoring';
    if (value === '6' || value.includes('closing')) return 'closing';
    return value.replace(/[\s_-]+/g, '');
  }

  toProjectStatusApiValue(statusId: string): string {
    const known = DashboardFilterService.PROJECT_STATUS_OPTIONS.find((s) => s.id === statusId);
    if (known?.apiValue) return known.apiValue;
    return statusId.split(/[\s_-]+/).filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }

  toStatusLabel(statusId: string): string {
    const known = DashboardFilterService.PROJECT_STATUS_OPTIONS.find((s) => s.id === statusId);
    if (known?.label) return known.label;
    return statusId.replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[\s_-]+/g, ' ').trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  defaultFilterState(): DashboardFilterState {
    return {
      selectedYear: null, selectedMonth: null, selectedYtd: false,
      selectedStartDate: null, selectedEndDate: null,
      selectedRoleId: 'all', selectedProjectStatus: 'all',
      selectedProjectPhase: 'all', selectedProcessStatus: 'all',
      selectedProjectManagementType: 'all',
      selectedDepartment: 'all', selectedBusinessUnit: 'all', selectedPlant: 'all',
    };
  }

}
