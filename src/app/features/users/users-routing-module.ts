import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { UserDetail } from './pages/user-detail/user-detail';
import { UserForm } from './pages/user-form/user-form';
import { UserList } from './pages/user-list/user-list';

const routes: Routes = [
  {
    path: '',
    component: UserList,
  },
  {
    path: 'new',
    component: UserForm,
  },
  {
    path: ':id',
    component: UserDetail,
  },
  {
    path: ':id/edit',
    component: UserForm,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsersRoutingModule {}

