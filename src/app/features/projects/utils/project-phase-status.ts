import { ProjectPhase, ProjectStatus } from '../models';

export const ALLOWED_STATUSES_BY_PHASE: Record<ProjectPhase, ProjectStatus[]> = {
  [ProjectPhase.Pipeline]: [
    ProjectStatus.Planned,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.PreProcess]: [
    ProjectStatus.Planned,
    ProjectStatus.Ongoing,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.Initiation]: [
    ProjectStatus.Planned,
    ProjectStatus.Ongoing,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.Planification]: [
    ProjectStatus.Planned,
    ProjectStatus.Ongoing,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.Execution]: [
    ProjectStatus.Ongoing,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.Monitoring]: [
    ProjectStatus.Ongoing,
    ProjectStatus.OnHold
  ],
  [ProjectPhase.Closing]: [
    ProjectStatus.Ongoing,
    ProjectStatus.Done
  ],
};

export const DEFAULT_PROJECT_PHASE = ProjectPhase.Pipeline;
export const DEFAULT_PROJECT_STATUS = ProjectStatus.Planned;

export const PROJECT_PHASE_STATUS_MESSAGES = {
  incompatible: 'Le statut sélectionné est incompatible avec la phase.',
  estimatedStartRequired: 'Une date de démarrage estimée est obligatoire pour un projet en attente.',
  doneRequiresClosing: 'Un projet terminé doit être en phase Closing.',
  endDateRequired: 'Une date de fin est obligatoire pour un projet terminé.',
  endDateInvalid: 'La date de fin doit être postérieure à la date de début.',
  estimatedDueInvalid: 'La date d’échéance estimée doit être postérieure à la date de début.',
  historicalInvalid:
    'La combinaison Phase + Statut actuelle n’est plus valide. Corrigez-la avant toute autre modification.',
} as const;

export interface ProjectPhaseStatusFormValue {
  phase: ProjectPhase | null | undefined;
  status: ProjectStatus | null | undefined;
  estimatedStartDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  estimatedDueDate?: string | null;
}

export function allowedStatusesForPhase(phase: ProjectPhase | null | undefined): readonly ProjectStatus[] {
  if (phase === null || phase === undefined) {
    return [];
  }

  return ALLOWED_STATUSES_BY_PHASE[phase] ?? [];
}

export function allowedPhasesForStatus(status: ProjectStatus | null | undefined): ProjectPhase[] {
  if (status === null || status === undefined) {
    return [];
  }

  return [
    ProjectPhase.Pipeline,
    ProjectPhase.PreProcess,
    ProjectPhase.Initiation,
    ProjectPhase.Planification,
    ProjectPhase.Execution,
    ProjectPhase.Monitoring,
    ProjectPhase.Closing,
  ].filter((phase) => ALLOWED_STATUSES_BY_PHASE[phase].includes(status));
}

export function isPhaseStatusAllowed(
  phase: ProjectPhase | null | undefined,
  status: ProjectStatus | null | undefined
): boolean {
  if (phase === null || phase === undefined || status === null || status === undefined) {
    return true;
  }

  return allowedStatusesForPhase(phase).includes(status);
}

export function coerceStatusForPhase(
  phase: ProjectPhase,
  status: ProjectStatus | null | undefined
): ProjectStatus {
  const allowed = allowedStatusesForPhase(phase);
  if (status !== null && status !== undefined && allowed.includes(status)) {
    return status;
  }

  if (phase === ProjectPhase.Pipeline) {
    return ProjectStatus.Planned;
  }

  if (phase === ProjectPhase.Closing) {
    return ProjectStatus.Ongoing;
  }

  return allowed[0] ?? ProjectStatus.Planned;
}

export function coercePhaseForStatus(
  status: ProjectStatus,
  phase: ProjectPhase | null | undefined
): ProjectPhase {
  if (status === ProjectStatus.Done) {
    return ProjectPhase.Closing;
  }

  const allowed = allowedPhasesForStatus(status);
  if (phase !== null && phase !== undefined && allowed.includes(phase)) {
    return phase;
  }

  return allowed[0] ?? DEFAULT_PROJECT_PHASE;
}

export function isFilledDate(value: string | null | undefined): boolean {
  return !!String(value || '').trim();
}

export function isDateStrictlyAfter(
  later: string | null | undefined,
  earlier: string | null | undefined
): boolean {
  if (!isFilledDate(later) || !isFilledDate(earlier)) {
    return true;
  }

  return new Date(later as string) > new Date(earlier as string);
}

export function validateProjectForm(form: ProjectPhaseStatusFormValue): string | null {
  const { phase, status } = form;

  if (phase === null || phase === undefined || status === null || status === undefined) {
    return null;
  }

  if (!isPhaseStatusAllowed(phase, status)) {
    return PROJECT_PHASE_STATUS_MESSAGES.incompatible;
  }

  if (status === ProjectStatus.OnHold && !isFilledDate(form.estimatedStartDate)) {
    return PROJECT_PHASE_STATUS_MESSAGES.estimatedStartRequired;
  }

  if (status === ProjectStatus.Done) {
    if (phase !== ProjectPhase.Closing) {
      return PROJECT_PHASE_STATUS_MESSAGES.doneRequiresClosing;
    }

    if (!isFilledDate(form.endDate)) {
      return PROJECT_PHASE_STATUS_MESSAGES.endDateRequired;
    }
  }

  if (isFilledDate(form.endDate) && !isDateStrictlyAfter(form.endDate, form.startDate)) {
    return PROJECT_PHASE_STATUS_MESSAGES.endDateInvalid;
  }

  if (isFilledDate(form.estimatedDueDate) && !isDateStrictlyAfter(form.estimatedDueDate, form.startDate)) {
    return PROJECT_PHASE_STATUS_MESSAGES.estimatedDueInvalid;
  }

  return null;
}
