import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  ProcessStatus,
  ProjectDto,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectStatus,
  StrategicCriterionScore,
  StrategicCriterionType,
} from '../../models';

@Component({
  selector: 'app-project-detail',
  standalone: false,
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
  private readonly statusLabels: Record<ProjectStatus, string> = {
    [ProjectStatus.Planned]: 'Planned',
    [ProjectStatus.Ongoing]: 'Ongoing',
    [ProjectStatus.OnHold]: 'On Hold',
    [ProjectStatus.Done]: 'Done',
  };

  private readonly phaseLabels: Record<ProjectPhase, string> = {
    [ProjectPhase.Pipeline]: 'Pipeline',
    [ProjectPhase.PreProcess]: 'Pre-Process',
    [ProjectPhase.Initiation]: 'Initiation',
    [ProjectPhase.Planification]: 'Planification',
    [ProjectPhase.Execution]: 'Execution',
    [ProjectPhase.Monitoring]: 'Monitoring',
    [ProjectPhase.Closing]: 'Closing',
  };

  private readonly processStatusLabels: Record<ProcessStatus, string> = {
    [ProcessStatus.NotStarted]: 'Not Started',
    [ProcessStatus.AsIsProcessUnderstanding]: 'As-Is Process Understanding',
    [ProcessStatus.ToBeProcessDefinition]: 'To-Be Process Definition',
    [ProcessStatus.OnHold]: 'On Hold',
    [ProcessStatus.Completed]: 'Completed',
    [ProcessStatus.ImplementedInPDMlink]: 'Implemented In PDMlink',
    [ProcessStatus.Cancelled]: 'Cancelled',
  };

  private readonly projectTypeLabels: Record<ProjectType, string> = {
    [ProjectType.NewProject]: 'New Project',
    [ProjectType.NewPhase]: 'New Phase',
    [ProjectType.Extension]: 'Extension',
    [ProjectType.Sustain]: 'Sustain',
    [ProjectType.NewProcessProject]: 'New Process Project',
  };

  private readonly managementTypeLabels: Record<ProjectManagementType, string> = {
    [ProjectManagementType.DigitalOperation]:      'Digital Operation',
    [ProjectManagementType.DigitalSolution]:       'Digital Solution',
    [ProjectManagementType.Infrastructure]:        'Infrastructure',
    [ProjectManagementType.ProcessSimplification]: 'Process Simplification',
    [ProjectManagementType.Other]:                 'Other',
  } as Record<ProjectManagementType, string>;

  private readonly strategicCriterionLabels: Record<StrategicCriterionType, string> = {
    [StrategicCriterionType.FinancialImpact]: 'Financial Impact',
    [StrategicCriterionType.CustomerImpact]: 'Customer Impact',
    [StrategicCriterionType.OperationalEfficiency]: 'Operational Efficiency',
    [StrategicCriterionType.StrategicAlignment]: 'Strategic Alignment',
    [StrategicCriterionType.CrossFunctionalImpact]: 'Cross-Functional Impact',
    [StrategicCriterionType.InnovationDigitalisation]: 'Innovation / Digitalisation',
    [StrategicCriterionType.RiskMitigationUrgency]: 'Risk Mitigation / Urgency',
    [StrategicCriterionType.SustainabilityESG]: 'Sustainability / ESG',
  };

  project?: ProjectDto;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.project = this.route.snapshot.data['project'] as ProjectDto | undefined;
  }

  backToList(): void {
    this.router.navigate([this.projectsBasePath()]);
  }

  editProject(): void {
    if (!this.project) {
      return;
    }

    this.router.navigate(['/admin/projects', this.project.id, 'edit']);
  }

  getProgress(project: ProjectDto): number {
    const value = Number(project.progressPercentage ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  getProgressTone(project: ProjectDto): 'low' | 'mid' | 'high' {
    const progress = this.getProgress(project);
    if (progress < 40) {
      return 'low';
    }
    if (progress < 75) {
      return 'mid';
    }
    return 'high';
  }

  getStatusTone(project: ProjectDto): 'planned' | 'ongoing' | 'onhold' | 'done' {
    switch (project.status) {
      case ProjectStatus.Planned:
        return 'planned';
      case ProjectStatus.OnHold:
        return 'onhold';
      case ProjectStatus.Done:
        return 'done';
      case ProjectStatus.Ongoing:
      default:
        return 'ongoing';
    }
  }

  getMomentumTone(project: ProjectDto): 'early' | 'steady' | 'advanced' {
    const progress = this.getProgress(project);
    if (progress < 35) {
      return 'early';
    }
    if (progress < 75) {
      return 'steady';
    }
    return 'advanced';
  }

  splitTextItems(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/\r?\n|[;]+/g)
      .map((item) => item.trim())
      .filter((item) => !!item);
  }

  private projectsBasePath(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path.includes('/admin/projects') ? '/admin/projects' : '/projects';
  }

  getStatusLabel(project: ProjectDto): string {
    return project.statusLabel || this.statusLabels[project.status] || String(project.status);
  }

  getPhaseLabel(project: ProjectDto): string {
    return project.phaseLabel || this.phaseLabels[project.phase] || String(project.phase);
  }

  getProcessStatusLabel(project: ProjectDto): string {
    return project.processStatusLabel || this.processStatusLabels[project.processStatus] || String(project.processStatus);
  }

  getProjectManagementTypeLabel(project: ProjectDto): string {
    const value = project.projectManagementType;
    if (value !== undefined && value !== null && this.managementTypeLabels[value]) {
      return this.managementTypeLabels[value];
    }
    const label = project.projectManagementTypeLabel;
    if (label && label.toLowerCase() !== 'development') return label;
    return value !== undefined && value !== null ? `Category ${value}` : 'N/A';
  }

  getProjectTypeLabel(project: ProjectDto): string {
    const value = project.projectType as unknown as ProjectType;
    if (value !== undefined && value !== null && this.projectTypeLabels[value]) {
      return this.projectTypeLabels[value];
    }
    const label = project.projectTypeLabel;
    if (label && label.toLowerCase() !== 'development') return label;
    return value !== undefined && value !== null ? `Type ${value}` : 'N/A';
  }

  getStrategicCriterionLabel(type: number): string {
    return this.strategicCriterionLabels[type as StrategicCriterionType] || `Type ${type}`;
  }

  getStrategicScoreLabel(score: number | null): string {
    if (score === null || score === undefined) {
      return 'N/A';
    }
    if (score === StrategicCriterionScore.Low) {
      return 'Low (1)';
    }
    if (score === StrategicCriterionScore.Medium) {
      return 'Medium (3)';
    }
    if (score === StrategicCriterionScore.High) {
      return 'High (5)';
    }
    return String(score);
  }

  hasParentProject(project: ProjectDto): boolean {
    const name = (project.parentProjectName ?? '').trim();
    if (!name) {
      return false;
    }
    return name.toLowerCase() !== 'n/a';
  }
}
