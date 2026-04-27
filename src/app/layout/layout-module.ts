import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { MainLayout } from './main-layout/main-layout';
import { Sidebar } from './main-layout/sidebar/sidebar';
import { AuthLayout } from './auth-layout/auth-layout';

@NgModule({
  declarations: [
    MainLayout,
    Sidebar,
    AuthLayout
  ],
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule
  ],
  exports: [
    MainLayout,
    Sidebar,
    AuthLayout
  ]
})
export class LayoutModule { }
