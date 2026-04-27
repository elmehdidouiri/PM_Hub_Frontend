import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FileManager } from './pages/file-manager/file-manager';

const routes: Routes = [
  {
    path: '',
    component: FileManager
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FilesRoutingModule { }
