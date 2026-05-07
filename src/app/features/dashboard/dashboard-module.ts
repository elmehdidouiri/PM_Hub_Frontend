import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { StatsCard } from './components/stats-card/stats-card';

@NgModule({
  declarations: [
    StatsCard,
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule,
    DashboardHome,
  ],
})
export class DashboardModule {}

