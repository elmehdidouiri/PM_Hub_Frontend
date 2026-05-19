import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { projectManagementAdminGuard } from './guards/admin-projects.guard';
import { projectDraftGuard } from './guards/project-draft.guard';
import { ProjectList } from './pages/project-list/project-list';
import { ProjectDetail } from './pages/project-detail/project-detail';
import { ProjectForm } from './pages/project-form/project-form';
import { ProjectCreatePage } from './pages/project-create-page/project-create-page';
import { ProjectEditPage } from './pages/project-edit-page/project-edit-page';
import { ProjectDetailsPage } from './pages/project-details-page/project-details-page';
import { projectDetailsResolver } from './resolvers/project-details.resolver';
import { projectEditorResolver } from './resolvers/project-editor.resolver';
import { projectReferencesResolver } from './resolvers/project-references.resolver';

const routes: Routes = [
  {
    path: '',
    component: ProjectList,
  },
  {
    path: 'new',
    canActivate: [projectManagementAdminGuard],
    canDeactivate: [projectDraftGuard],
    component: ProjectCreatePage,
    resolve: {
      refs: projectReferencesResolver,
    },
    data: {
      mode: 'create',
    },
  },
  {
    path: ':id',
    component: ProjectEditPage,
    resolve: {
      project: projectDetailsResolver,
      refs: projectReferencesResolver,
    },
    data: {
      mode: 'details',
    },
  },
  {
    path: ':id/edit',
    canActivate: [projectManagementAdminGuard],
    component: ProjectEditPage,
    resolve: {
      project: projectEditorResolver,
      refs: projectReferencesResolver,
    },
    data: {
      mode: 'edit',
    },
  },
  {
    path: 'legacy/new',
    redirectTo: 'new',
    pathMatch: 'full',
  },
  {
    path: 'legacy/:id/edit',
    redirectTo: ':id/edit',
    pathMatch: 'full',
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }
