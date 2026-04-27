import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { StatsCard } from './components/stats-card/stats-card';


@NgModule({
  declarations: [
    DashboardHome,
    StatsCard
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    MatIconModule,
    FormsModule
  ]
})
export class DashboardModule { }
