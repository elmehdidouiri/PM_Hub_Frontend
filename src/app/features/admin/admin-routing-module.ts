import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { RolesAdminPage } from './pages/roles-admin-page/roles-admin-page';
import { ReferenceAdminPage } from './pages/reference-admin-page/reference-admin-page';
import { UserApprovalsPage } from './pages/user-approvals/user-approvals';
import { HourBookingNotificationsPage } from './pages/hour-booking-notifications/hour-booking-notifications';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'roles',
    pathMatch: 'full',
  },
  {
    path: 'roles',
    component: RolesAdminPage,
  },
  {
    path: 'business-units',
    component: ReferenceAdminPage,
    data: { entity: 'business-units' },
  },
  {
    path: 'departments',
    component: ReferenceAdminPage,
    data: { entity: 'departments' },
  },
  {
    path: 'plants',
    component: ReferenceAdminPage,
    data: { entity: 'plants' },
  },
  {
    path: 'technologies',
    component: ReferenceAdminPage,
    data: { entity: 'technologies' },
  },
  {
    path: 'solution-domains',
    component: ReferenceAdminPage,
    data: { entity: 'solution-domains' },
  },
  {
    path: 'approvals',
    component: UserApprovalsPage,
  },
  {
    path: 'hour-booking-notifications',
    component: HourBookingNotificationsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}

