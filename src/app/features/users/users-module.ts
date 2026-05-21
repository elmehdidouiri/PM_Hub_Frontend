import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { UsersRoutingModule } from './users-routing-module';
import { UserList } from './pages/user-list/user-list';
import { UserDetail } from './pages/user-detail/user-detail';
import { UserForm } from './pages/user-form/user-form';
import { InternDetailsDialog } from './components/intern-details-dialog/intern-details-dialog';
import { SharedModule } from '../../shared/shared.module';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MetricCardComponent } from '../dashboard/components/metric-card/metric-card.component';
import { ChartBarComponent } from '../dashboard/components/chart-bar/chart-bar.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [UserList, UserDetail, UserForm],
  imports: [
    CommonModule, 
    SharedModule, 
    UsersRoutingModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatBadgeModule,
    MetricCardComponent,
    ChartBarComponent,
    RouterModule
  ],
})
export class UsersModule {}

