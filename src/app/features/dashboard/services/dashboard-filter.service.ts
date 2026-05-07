import { Injectable } from '@angular/core';
import { DashboardFilterParams } from '../../projects/models';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardFilterState {
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedRoleId: string;
  selectedProjectStatus: string;
  selectedProjectPhase: string;
  selectedProcessStatus: string;
  selectedDepartment: string;
  selectedBusinessUnit: string;
  selectedPlant: string;
}

export interface FilterTicket {
  id: string;
  label: string;
  count: number;
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
    { id: 'ongoing', label: 'Ongoing',  apiValue: '0' },
    { id: 'onhold',  label: 'On Hold',  apiValue: '1' },
    { id: 'done',    label: 'Done',     apiValue: '2' },
    { id: 'planned', label: 'Planned',  apiValue: '3' },
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
      month:          state.selectedMonth ?? undefined,
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
      ytd: state.selectedYear !== null && state.selectedMonth === null ? true : undefined,
    };
  }

  hasAnyFilterSelected(state: DashboardFilterState): boolean {
    return (
      state.selectedYear !== null ||
      state.selectedMonth !== null ||
      state.selectedRoleId !== 'all' ||
      state.selectedBusinessUnit !== 'all' ||
      state.selectedPlant !== 'all' ||
      state.selectedProjectStatus !== 'all' ||
      state.selectedProjectPhase !== 'all' ||
      state.selectedProcessStatus !== 'all' ||
      state.selectedDepartment !== 'all'
    );
  }

  activeFilterCount(state: DashboardFilterState): number {
    return [
      state.selectedBusinessUnit !== 'all',
      state.selectedDepartment !== 'all',
      state.selectedProjectPhase !== 'all',
      state.selectedProjectStatus !== 'all',
      state.selectedYear !== null,
      state.selectedMonth !== null,
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
      const label = (p.departmentName || p.department || 'Unknown').trim();
      const id = p.departmentId || departmentIdByName.get(label) || label;
      const current = stats.get(id) || { label, count: 0 };
      current.count++;
      stats.set(id, current);
    }
    return [...stats.entries()]
      .map(([id, info]) => ({ id, label: info.label, count: info.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  buildBusinessUnitTickets(
    projects: any[],
    businessUnitIdByName: Map<string, string>,
  ): FilterTicket[] {
    const stats = new Map<string, { label: string; count: number }>();
    businessUnitIdByName.forEach((id, name) => stats.set(id, { label: name, count: 0 }));
    for (const project of projects) {
      const units: string[] = Array.isArray(project.businessUnits) ? project.businessUnits : [];
      const ids: string[] = Array.isArray(project.businessUnitIds) ? project.businessUnitIds : [];
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
        const label = (project.businessUnitName || project.businessUnit || '').trim();
        const id = project.businessUnitId || (label ? businessUnitIdByName.get(label) : null);
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
      const label = (p.plantName ?? p.PlantName ?? p.plant ?? p.Plant ?? '').trim();
      if (!label) continue;
      const id = plantIdByName.get(label) || label;
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
      const normalized = this.normalizeProjectStatusId(p.status || p.projectStatus || '');
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
      const phase = `${p.phaseLabel || p.phase || ''}`.trim().toLowerCase();
      if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1);
    }
    const dynamicTickets = phaseOptions
      .filter((s) => s.id !== 'all')
      .map((s) => ({ 
        id: s.id, 
        label: s.label, 
        count: counts.get(s.label.toLowerCase()) ?? counts.get(s.id) ?? 0 
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
      selectedYear: null, selectedMonth: null,
      selectedRoleId: 'all', selectedProjectStatus: 'all',
      selectedProjectPhase: 'all', selectedProcessStatus: 'all',
      selectedDepartment: 'all', selectedBusinessUnit: 'all', selectedPlant: 'all',
    };
  }
}
