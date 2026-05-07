import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type ConfirmationDialogResult = 'save' | 'discard' | 'cancel';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  icon?: string;
  saveLabel?: string;
  saveColor?: 'primary' | 'warn' | 'accent';
  discardLabel?: string;
  cancelLabel?: string;
  hideDiscard?: boolean;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: false,
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialog {
  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmationDialog, ConfirmationDialogResult>,
    @Inject(MAT_DIALOG_DATA) readonly data: ConfirmationDialogData
  ) {}

  close(result: ConfirmationDialogResult): void {
    this.dialogRef.close(result);
  }
}
