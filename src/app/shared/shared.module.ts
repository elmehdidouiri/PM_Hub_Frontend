import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

// Shared Components
import { ErrorDialogComponent } from './components/error-dialog/error-dialog.component';
import { ConfirmationDialog } from './components/confirmation-dialog/confirmation-dialog';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';
import { GlobalLoaderComponent } from './components/global-loader/global-loader';
import { PageHeader } from './components/page-header/page-header';
import { InternDetailsDialog } from '../features/users/components/intern-details-dialog/intern-details-dialog';

const MATERIAL_MODULES = [
  MatButtonModule,
  MatIconModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatMenuModule,
  MatTooltipModule
];

@NgModule({
  declarations: [
    ConfirmationDialog,
    PageHeader,
    InternDetailsDialog
  ],
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ErrorDialogComponent,
    LoadingSpinner,
    GlobalLoaderComponent
  ],
  exports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ErrorDialogComponent,
    ConfirmationDialog,
    PageHeader,
    LoadingSpinner,
    GlobalLoaderComponent,
    InternDetailsDialog
  ]
})
export class SharedModule { }
