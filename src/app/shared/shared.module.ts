import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Shared Components
import { ErrorDialogComponent } from './components/error-dialog/error-dialog.component';
import { ConfirmationDialog } from './components/confirmation-dialog/confirmation-dialog';

const MATERIAL_MODULES = [
  MatButtonModule,
  MatIconModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule
];

 
@NgModule({
  declarations: [
    ConfirmationDialog
  ],
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ErrorDialogComponent
  ],
  exports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ErrorDialogComponent,
    ConfirmationDialog
  ]
})
export class SharedModule { }
