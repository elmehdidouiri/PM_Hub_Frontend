import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { FilesRoutingModule } from './files-routing-module';
import { FileManager } from './pages/file-manager/file-manager';
import { SharedModule } from '../../shared/shared.module';


@NgModule({
  declarations: [
    FileManager
  ],
  imports: [
    CommonModule,
    SharedModule,
    FilesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule
  ]
})
export class FilesModule { }
