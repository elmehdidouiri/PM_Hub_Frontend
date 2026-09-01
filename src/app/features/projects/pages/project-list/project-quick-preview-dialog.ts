import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of } from 'rxjs';

import { ProjectDto, ProjectStatus } from '../../models';
import { ProjectService } from '../../services/project';

export interface ProjectQuickPreviewDialogData {
  projectId: string;
}

@Component({
  selector: 'app-project-quick-preview-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, MatDialogModule, MatIconModule],
  template: `
    <div class="preview" *ngIf="!isLoading; else loading">
      <header class="preview__header">
        <div>
          <span class="eyebrow">Project snapshot</span>
          <h2>{{ project?.name || 'Project' }}</h2>
          <p>{{ project?.departmentName || 'No department' }} · {{ project?.plantName || 'No plant' }}</p>
        </div>
        <button type="button" class="icon-btn" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
      </header>

      <ng-container *ngIf="project; else error">
        <section class="badges">
          <span class="badge" [class.badge--done]="isDone">{{ project.statusLabel || project.status }}</span>
          <span class="badge">{{ project.phaseLabel || project.phase }}</span>
          <span class="badge">{{ project.projectManagementTypeLabel || 'Project' }}</span>
        </section>

        <section class="critical" *ngIf="alerts.length">
          <div class="critical__title"><mat-icon>priority_high</mat-icon><span>Needs attention</span></div>
          <ul><li *ngFor="let alert of alerts">{{ alert }}</li></ul>
        </section>

        <section class="metrics" aria-label="Critical project metrics">
          <article><span>Progress</span><strong>{{ project.progressPercentage || 0 }}%</strong><i><b [style.width.%]="project.progressPercentage || 0"></b></i></article>
          <article><span>Hours</span><strong>{{ project.actualHours || 0 }} / {{ project.estimatedHours || 0 }}h</strong><small>Actual / estimate</small></article>
          <article><span>Due date</span><strong>{{ project.estimatedDueDate ? (project.estimatedDueDate | date:'dd MMM y') : 'Not set' }}</strong><small>{{ dueDateLabel }}</small></article>
          <article><span>Budget</span><strong>{{ project.budget | number:'1.0-0' }}</strong><small>Allocated budget</small></article>
        </section>

        <section class="section section--execution">
          <h3><mat-icon>monitor_heart</mat-icon> Execution</h3>
          <div class="execution-grid">
            <div><span>Current state</span><p>{{ value(project.currentState) }}</p></div>
            <div><span>Next steps</span><p>{{ value(project.nextSteps) }}</p></div>
            <div class="roadblocks"><span>Roadblocks</span><p>{{ value(project.roadblocks) }}</p></div>
          </div>
        </section>

        <div class="details-grid">
          <section class="section">
            <h3><mat-icon>groups</mat-icon> Ownership</h3>
            <dl>
              <div><dt>Project manager</dt><dd>{{ value(project.projectManagerName) }}</dd></div>
              <div><dt>Sponsor</dt><dd>{{ value(project.sponsor) }}</dd></div>
              <div><dt>Department</dt><dd>{{ value(project.departmentName) }}</dd></div>
            </dl>
          </section>
          <section class="section">
            <h3><mat-icon>category</mat-icon> Scope</h3>
            <dl>
              <div><dt>Type</dt><dd>{{ project.projectTypeLabel || project.projectType }}</dd></div>
              <div><dt>Business units</dt><dd>{{ project.businessUnits.join(', ') || 'Not set' }}</dd></div>
              <div><dt>Team</dt><dd>{{ project.members.length || 0 }} member(s)</dd></div>
            </dl>
          </section>
        </div>

        <section class="section description">
          <h3><mat-icon>subject</mat-icon> Description</h3>
          <p>{{ value(project.description) }}</p>
        </section>

        <div class="details-grid">
          <section class="section">
            <h3><mat-icon>event</mat-icon> Planning</h3>
            <dl>
              <div><dt>Start date</dt><dd>{{ project.startDate | date:'dd MMM y' }}</dd></div>
              <div><dt>End date</dt><dd>{{ project.endDate ? (project.endDate | date:'dd MMM y') : 'Not set' }}</dd></div>
              <div><dt>Process status</dt><dd>{{ project.processStatusLabel || project.processStatus }}</dd></div>
              <div><dt>Last update</dt><dd>{{ project.updatedAt ? (project.updatedAt | date:'dd MMM y') : 'Not set' }}</dd></div>
            </dl>
          </section>
          <section class="section">
            <h3><mat-icon>payments</mat-icon> Financials</h3>
            <dl>
              <div><dt>Budget</dt><dd>{{ project.budget | number:'1.0-0' }}</dd></div>
              <div><dt>Cost saving</dt><dd>{{ project.costSaving | number:'1.0-0' }}</dd></div>
              <div><dt>Digital contribution</dt><dd>{{ project.digitalContribution | number:'1.0-2' }}</dd></div>
              <div><dt>Cost center</dt><dd>{{ value(project.costCenter) }}</dd></div>
            </dl>
          </section>
        </div>

        <section class="section section--wide">
          <h3><mat-icon>code</mat-icon> Technical information</h3>
          <dl>
            <div><dt>Technologies</dt><dd>{{ project.technologies.join(', ') || 'Not set' }}</dd></div>
            <div><dt>Solution domains</dt><dd>{{ project.solutionDomains.join(', ') || 'Not set' }}</dd></div>
            <div><dt>Server / host</dt><dd>{{ value(project.serverHostName) }}</dd></div>
            <div><dt>Source code</dt><dd><a *ngIf="project.codeSourceLink; else noCode" [href]="project.codeSourceLink" target="_blank" rel="noopener">Open link</a><ng-template #noCode>Not set</ng-template></dd></div>
            <div><dt>Solution</dt><dd><a *ngIf="project.solutionLink; else noSolution" [href]="project.solutionLink" target="_blank" rel="noopener">Open link</a><ng-template #noSolution>Not set</ng-template></dd></div>
          </dl>
        </section>

        <section class="section section--wide" *ngIf="project.members.length">
          <h3><mat-icon>group</mat-icon> Team members ({{ project.members.length }})</h3>
          <div class="mini-table"><div *ngFor="let member of project.members"><strong>{{ member.fullName }}</strong><span>{{ member.roleName || 'No role' }}</span><small>{{ member.email || '' }}</small></div></div>
        </section>

        <section class="section section--wide" *ngIf="kpis.length">
          <h3><mat-icon>track_changes</mat-icon> KPIs ({{ kpis.length }})</h3>
          <div class="mini-table"><div *ngFor="let kpi of kpis"><strong>{{ kpi.name }}</strong><span>Current: {{ kpi.currentValue ?? '—' }} / Target: {{ kpi.targetValue ?? '—' }}</span><small>{{ kpi.description || '' }}</small></div></div>
        </section>

        <section class="section section--wide" *ngIf="project.projectResources.length">
          <h3><mat-icon>inventory_2</mat-icon> Resources</h3>
          <div class="mini-table"><div *ngFor="let resource of project.projectResources"><strong>{{ resource.itemName }}</strong><span>{{ resource.quantity || 0 }} × {{ resource.pricePerUnit || 0 }}</span><small>{{ resource.costCenter || '' }}</small></div></div>
        </section>

        <section class="section section--wide" *ngIf="project.strategicCriteria.length">
          <h3><mat-icon>stars</mat-icon> Strategic criteria</h3>
          <div class="mini-table"><div *ngFor="let criterion of project.strategicCriteria"><strong>{{ criterion.type }}</strong><span>Score: {{ criterion.score }}</span><small>{{ criterion.comment || '' }}</small></div></div>
        </section>

        <section class="section section--wide">
          <h3><mat-icon>folder_copy</mat-icon> Project content</h3>
          <div class="content-counts"><span>Deliverables <strong>{{ project.deliverables.length }}</strong></span><span>Timeline entries <strong>{{ project.timelineEntries.length }}</strong></span><span>Sub-projects <strong>{{ project.subProjects.length }}</strong></span><span>Roadblock entries <strong>{{ project.roadblockEntries.length }}</strong></span></div>
        </section>
      </ng-container>

      <footer><button type="button" class="open-btn" (click)="openFullDetails()">Open full details <mat-icon>arrow_forward</mat-icon></button></footer>
    </div>

    <ng-template #loading><div class="loading"><mat-icon>hourglass_top</mat-icon><span>Loading project information…</span></div></ng-template>
    <ng-template #error><div class="error"><mat-icon>error_outline</mat-icon><p>Unable to load this project.</p></div></ng-template>
  `,
  styles: [`
    .preview { color:#14213d; min-width:min(760px, calc(100vw - 32px)); max-width:860px; max-height:88vh; overflow-y:auto; scrollbar-gutter:stable; }
    .preview__header { display:flex; justify-content:space-between; gap:20px; padding:24px 26px 16px; border-bottom:1px solid #e7edf5; }
    .eyebrow { color:#e86616; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
    h2 { margin:5px 0 3px; font-size:24px; line-height:1.2; } .preview__header p { margin:0; color:#64748b; font-size:13px; }
    .icon-btn { border:0; background:#f3f6fa; color:#52657f; border-radius:9px; width:36px; height:36px; cursor:pointer; }
    .badges { display:flex; flex-wrap:wrap; gap:8px; padding:16px 26px 0; }.badge { border:1px solid #dce5f0; border-radius:99px; padding:5px 9px; color:#365273; font-size:11px; font-weight:700; background:#f8fbff; }.badge--done { color:#16855a; background:#edfbf4; border-color:#bfe9d4; }
    .critical { margin:16px 26px 0; padding:12px 14px; border:1px solid #ffd8bf; background:#fff7f1; border-radius:10px; color:#9a3f0c; }.critical__title { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:800; }.critical mat-icon { width:18px; height:18px; font-size:18px; }.critical ul { margin:7px 0 0 24px; padding:0; font-size:12px; line-height:1.55; }
    .metrics { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; padding:18px 26px; }.metrics article { background:#f7f9fc; border:1px solid #e7edf5; border-radius:10px; padding:12px; }.metrics span,.section span,dt { display:block; font-size:10px; color:#6d7d93; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }.metrics strong { display:block; margin:5px 0; font-size:14px; }.metrics small { color:#77869a; font-size:11px; }.metrics i { display:block; height:4px; background:#dce4ef; border-radius:4px; overflow:hidden; }.metrics b { display:block; height:100%; background:#ef6c19; border-radius:4px; }
    .section { border:1px solid #e7edf5; border-radius:10px; padding:14px; }.section h3 { display:flex; align-items:center; gap:6px; margin:0 0 12px; font-size:13px; }.section h3 mat-icon { color:#e86616; font-size:18px; width:18px; height:18px; }.section--execution { margin:0 26px 14px; }.section--wide { margin:0 26px 14px; }.execution-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }.section p { margin:5px 0 0; color:#30425e; font-size:12px; line-height:1.45; }.roadblocks p { color:#bb3e18; }.details-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:0 26px 14px; }dl { margin:0; } dl div { display:flex; justify-content:space-between; gap:12px; padding:5px 0; border-bottom:1px solid #f0f3f7; } dl div:last-child { border:0; } dd { margin:0; text-align:right; color:#263852; font-size:12px; font-weight:600; } dd a { color:#d95710; }.description { margin:0 26px 18px; }.mini-table { display:grid; gap:6px; }.mini-table > div { display:grid; grid-template-columns:minmax(150px, 1fr) minmax(130px, 1fr) minmax(110px, 1fr); gap:10px; padding:8px 0; border-bottom:1px solid #f0f3f7; font-size:12px; }.mini-table span,.mini-table small { color:#63748b; }.content-counts { display:flex; flex-wrap:wrap; gap:8px; }.content-counts span { background:#f4f7fb; color:#61728a; border-radius:7px; padding:7px 9px; text-transform:none; letter-spacing:0; }.content-counts strong { color:#253955; margin-left:4px; } footer { display:flex; justify-content:flex-end; border-top:1px solid #e7edf5; padding:15px 26px; }.open-btn { display:inline-flex; align-items:center; gap:7px; border:0; border-radius:8px; background:#e86616; color:#fff; padding:9px 14px; cursor:pointer; font-size:12px; font-weight:800; }.open-btn mat-icon { font-size:17px; width:17px; height:17px; }.loading,.error { min-width:360px; min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#66778d; }.error { color:#b94c21; }
    @media (max-width:680px) { .preview { min-width:calc(100vw - 20px); }.metrics { grid-template-columns:1fr 1fr; }.execution-grid,.details-grid { grid-template-columns:1fr; }.mini-table > div { grid-template-columns:1fr; gap:3px; }.preview__header,.badges,.metrics { padding-left:16px; padding-right:16px; }.section--execution,.section--wide,.description { margin-left:16px; margin-right:16px; }.details-grid { padding-left:16px; padding-right:16px; } }
  `],
})
export class ProjectQuickPreviewDialog implements OnInit {
  project: ProjectDto | null = null;
  isLoading = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ProjectQuickPreviewDialogData,
    private readonly dialogRef: MatDialogRef<ProjectQuickPreviewDialog>,
    private readonly projectService: ProjectService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.projectService.getProject(this.data.projectId).pipe(catchError(() => of(null))).subscribe((project) => {
      // The HTTP interceptor can synchronously return a cached response. Defer the update so it
      // cannot mutate a binding while Angular is checking this newly opened dialog.
      setTimeout(() => {
        this.project = project;
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    });
  }

  get isDone(): boolean { return this.project?.status === ProjectStatus.Done || this.project?.statusLabel?.toLowerCase() === 'done'; }
  get dueDateLabel(): string { return this.project?.estimatedDueDate && new Date(this.project.estimatedDueDate) < new Date() && !this.isDone ? 'Overdue' : 'Target date'; }
  get alerts(): string[] {
    if (!this.project) return [];
    const alerts: string[] = [];
    if (this.project.estimatedDueDate && new Date(this.project.estimatedDueDate) < new Date() && !this.isDone) alerts.push('The target due date has passed.');
    if (this.project.estimatedHours > 0 && this.project.actualHours > this.project.estimatedHours) alerts.push('Actual hours exceed the estimate.');
    if (this.project.roadblocks?.trim()) alerts.push('Roadblocks have been reported.');
    return alerts;
  }
  get kpis(): Array<{ name: string; targetValue: number | null; currentValue: number | null; description?: string | null }> {
    return this.project?.kpis ?? this.project?.KPIs ?? this.project?.kpIs ?? [];
  }
  value(value: string | null | undefined): string { return value?.trim() || 'Not provided'; }
  openFullDetails(): void { this.dialogRef.close('open-details'); }
}
