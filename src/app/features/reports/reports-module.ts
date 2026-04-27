import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ReportsRoutingModule } from './reports-routing-module';
import { HoursSummaryReportPage } from './pages/hours-summary-report-page/hours-summary-report-page';
import { ProjectOverviewReportPage } from './pages/project-overview-report-page/project-overview-report-page';

@NgModule({
  declarations: [HoursSummaryReportPage, ProjectOverviewReportPage],
  imports: [CommonModule, MatIconModule, ReportsRoutingModule],
})
export class ReportsModule {}

