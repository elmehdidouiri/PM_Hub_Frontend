import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';

import { ProjectsRoutingModule } from './projects-routing-module';
import { ProjectList } from './pages/project-list/project-list';
import { ProjectDetail } from './pages/project-detail/project-detail';
import { ProjectForm } from './pages/project-form/project-form';
import { ProjectCreatePage } from './pages/project-create-page/project-create-page';
import { ProjectEditPage } from './pages/project-edit-page/project-edit-page';
import { ProjectDetailsPage } from './pages/project-details-page/project-details-page';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    ProjectList,
    ProjectDetail,
    ProjectForm,
    ProjectCreatePage,
    ProjectEditPage,
    ProjectDetailsPage
  ],
  imports: [
    CommonModule,
    SharedModule,
    ProjectsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatStepperModule

  ],
  exports: [
    ProjectForm
  ]
})
export class ProjectsModule { }
