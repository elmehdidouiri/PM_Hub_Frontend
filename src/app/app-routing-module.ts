import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { MainLayout } from './layout/main-layout/main-layout';

const routes: Routes = [
  {
    path: 'server-error',
    loadComponent: () => import('./shared/components/server-error/server-error.component').then(m => m.ServerErrorComponent)
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule)
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard-module').then((m) => m.DashboardModule)
      },
      {
        path: 'admin/projects',
        loadChildren: () => import('./features/projects/projects-module').then((m) => m.ProjectsModule)
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin-module').then((m) => m.AdminModule)
      },
      {
        path: 'projects',
        loadChildren: () => import('./features/projects/projects-module').then((m) => m.ProjectsModule)
      },
      {
        path: 'interns',
        loadChildren: () => import('./features/interns/interns-module').then((m) => m.InternsModule)
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users-module').then((m) => m.UsersModule)
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/reports-module').then((m) => m.ReportsModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile-module').then((m) => m.ProfileModule)
      },
      {
        path: 'hours',
        loadChildren: () => import('./features/hours/hours-module').then((m) => m.HoursModule)
      },
      {
        path: 'files',
        loadChildren: () => import('./features/files/files-module').then((m) => m.FilesModule)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '' // Redirect to home/dashboard instead of login to avoid flicker
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
