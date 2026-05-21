import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { ProfileRoutingModule } from './profile-routing-module';
import { ProfilePage } from './pages/profile-page/profile-page';

@NgModule({
  declarations: [ProfilePage],
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, ProfileRoutingModule],
})
export class ProfileModule {}

