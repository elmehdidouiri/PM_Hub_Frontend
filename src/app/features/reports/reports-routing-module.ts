import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HoursSummaryReportPage } from './pages/hours-summary-report-page/hours-summary-report-page';
import { ProjectOverviewReportPage } from './pages/project-overview-report-page/project-overview-report-page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'project-overview',
    pathMatch: 'full',
  },
  {
    path: 'project-overview',
    component: ProjectOverviewReportPage,
  },
  {
    path: 'hours-summary',
    component: HoursSummaryReportPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsRoutingModule {}

