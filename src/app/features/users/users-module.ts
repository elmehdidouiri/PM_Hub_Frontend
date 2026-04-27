import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { UsersRoutingModule } from './users-routing-module';
import { UserList } from './pages/user-list/user-list';
import { UserDetail } from './pages/user-detail/user-detail';
import { UserForm } from './pages/user-form/user-form';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [UserList, UserDetail, UserForm],
  imports: [CommonModule, SharedModule, UsersRoutingModule, FormsModule, ReactiveFormsModule, MatIconModule],
})
export class UsersModule {}

