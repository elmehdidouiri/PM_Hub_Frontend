import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';

import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from './admin-routing-module';
import { RolesAdminPage } from './pages/roles-admin-page/roles-admin-page';
import { ReferenceAdminPage } from './pages/reference-admin-page/reference-admin-page';
import { UserApprovalsPage } from './pages/user-approvals/user-approvals';
import { HourBookingNotificationsPage } from './pages/hour-booking-notifications/hour-booking-notifications';

@NgModule({
  declarations: [RolesAdminPage, ReferenceAdminPage, UserApprovalsPage, HourBookingNotificationsPage],
  imports: [CommonModule, SharedModule, FormsModule, ReactiveFormsModule, MatIconModule, MatDialogModule, AdminRoutingModule],
})
export class AdminModule {}

