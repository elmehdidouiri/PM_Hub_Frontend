import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { AnalyticsDashboard } from './pages/analytics-dashboard/analytics-dashboard';
import { HoursAllocationDashboard } from './pages/hours-allocation-dashboard/hours-allocation-dashboard';

const routes: Routes = [
  {
    path: '',
    component: DashboardHome
  },
  {
    path: 'analytics',
    component: AnalyticsDashboard,
  },
  {
    path: 'hours-allocation',
    component: HoursAllocationDashboard,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
