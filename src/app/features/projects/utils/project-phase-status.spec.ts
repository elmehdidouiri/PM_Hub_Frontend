import { ProjectPhase, ProjectStatus } from '../models';
import {
  coercePhaseForStatus,
  coerceStatusForPhase,
  isPhaseStatusAllowed,
  validateProjectForm,
} from './project-phase-status';

describe('project-phase-status', () => {
  it('rejects Ongoing and Done in Pipeline', () => {
    expect(isPhaseStatusAllowed(ProjectPhase.Pipeline, ProjectStatus.Ongoing)).toBeFalse();
    expect(isPhaseStatusAllowed(ProjectPhase.Pipeline, ProjectStatus.Done)).toBeFalse();
    expect(isPhaseStatusAllowed(ProjectPhase.Pipeline, ProjectStatus.Planned)).toBeTrue();
    expect(isPhaseStatusAllowed(ProjectPhase.Pipeline, ProjectStatus.OnHold)).toBeTrue();
  });

  it('allows only Ongoing and OnHold in Execution and Monitoring', () => {
    expect(isPhaseStatusAllowed(ProjectPhase.Execution, ProjectStatus.Planned)).toBeFalse();
    expect(isPhaseStatusAllowed(ProjectPhase.Monitoring, ProjectStatus.Done)).toBeFalse();
    expect(isPhaseStatusAllowed(ProjectPhase.Execution, ProjectStatus.Ongoing)).toBeTrue();
  });

  it('allows only Ongoing and Done in Closing', () => {
    expect(isPhaseStatusAllowed(ProjectPhase.Closing, ProjectStatus.OnHold)).toBeFalse();
    expect(isPhaseStatusAllowed(ProjectPhase.Closing, ProjectStatus.Done)).toBeTrue();
  });

  it('coerces an invalid status when the phase changes', () => {
    expect(coerceStatusForPhase(ProjectPhase.Pipeline, ProjectStatus.Ongoing)).toBe(ProjectStatus.Planned);
    expect(coerceStatusForPhase(ProjectPhase.Closing, ProjectStatus.Planned)).toBe(ProjectStatus.Ongoing);
    expect(coerceStatusForPhase(ProjectPhase.Pipeline, ProjectStatus.OnHold)).toBe(ProjectStatus.OnHold);
  });

  it('forces Closing when status becomes Done', () => {
    expect(coercePhaseForStatus(ProjectStatus.Done, ProjectPhase.Execution)).toBe(ProjectPhase.Closing);
  });

  it('validates OnHold, Done and date rules', () => {
    expect(
      validateProjectForm({
        phase: ProjectPhase.Initiation,
        status: ProjectStatus.OnHold,
        estimatedStartDate: '',
      })
    ).toContain('démarrage estimée');

    expect(
      validateProjectForm({
        phase: ProjectPhase.Execution,
        status: ProjectStatus.Done,
      })
    ).toContain('Closing');

    expect(
      validateProjectForm({
        phase: ProjectPhase.Closing,
        status: ProjectStatus.Done,
        startDate: '2026-01-10',
        endDate: '2026-01-10',
      })
    ).toContain('date de fin');

    expect(
      validateProjectForm({
        phase: ProjectPhase.Pipeline,
        status: ProjectStatus.Planned,
        startDate: '2026-01-10',
        estimatedDueDate: '2026-01-01',
      })
    ).toContain('échéance estimée');
  });
});
