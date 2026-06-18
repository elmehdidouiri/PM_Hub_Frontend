import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';
import { InternList } from './pages/intern-list/intern-list';
import { InternDetail } from './pages/intern-detail/intern-detail';
import { InternForm } from './pages/intern-form/intern-form';

const routes: Routes = [
  {
    path: '',
    component: InternList
  },
  {
    path: 'new',
    canActivate: [roleGuard],
    data: { adminOnly: true },
    component: InternForm
  },
  {
    path: ':id',
    component: InternDetail
  },
  {
    path: ':id/edit',
    component: InternForm
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InternsRoutingModule { }
