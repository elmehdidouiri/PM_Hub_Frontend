import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { InternsRoutingModule } from './interns-routing-module';
import { InternList } from './pages/intern-list/intern-list';
import { InternDetail } from './pages/intern-detail/intern-detail';
import { InternForm } from './pages/intern-form/intern-form';
import { SharedModule } from '../../shared/shared.module';


@NgModule({
  declarations: [
    InternList,
    InternDetail,
    InternForm
  ],
  imports: [
    CommonModule,
    SharedModule,
    InternsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule
  ]
})
export class InternsModule { }
