import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { AnalyticsDashboard } from './pages/analytics-dashboard/analytics-dashboard';
import { HoursAllocationDashboard } from './pages/hours-allocation-dashboard/hours-allocation-dashboard';
import { roleGuard } from '../../core/guards/role-guard';
import { projectManagementAdminGuard } from '../projects/guards/admin-projects.guard';

const routes: Routes = [
  {
    path: '',
    component: DashboardHome
  },
  {
    path: 'analytics',
    canActivate: [roleGuard],
    data: { adminOnly: true },
    component: AnalyticsDashboard,
  },
  {
    path: 'hours-allocation',
    canActivate: [projectManagementAdminGuard],
    component: HoursAllocationDashboard,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
