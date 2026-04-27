import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ProfileRoutingModule } from './profile-routing-module';
import { ProfilePage } from './pages/profile-page/profile-page';

@NgModule({
  declarations: [ProfilePage],
  imports: [CommonModule, MatIconModule, ProfileRoutingModule],
})
export class ProfileModule {}

