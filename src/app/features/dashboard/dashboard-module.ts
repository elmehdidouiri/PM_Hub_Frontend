import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { StatsCard } from './components/stats-card/stats-card';

@NgModule({
  declarations: [
    StatsCard,
  ],
  imports: [
    CommonModule,
    MatIconModule,
    DashboardRoutingModule,
    DashboardHome,
  ],
})
export class DashboardModule {}

