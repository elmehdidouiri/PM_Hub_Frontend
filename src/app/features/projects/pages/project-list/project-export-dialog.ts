import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-project-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatIconModule
  ],
  template: `
    <div class="export-dialog-container">
      <div class="dialog-header">
        <mat-icon class="header-icon">download</mat-icon>
        <h2>Export Projects</h2>
      </div>

      <div class="dialog-body">
        <p class="subtitle">Choose the report format to export. Active filters on status, phase, and category will be applied.</p>
        
        <div class="options-grid">
          <label class="option-card" [class.active]="exportType === 'standard'">
            <input type="radio" name="exportOption" [(ngModel)]="exportType" value="standard" />
            <div class="card-icon"><mat-icon>list_alt</mat-icon></div>
            <div class="card-text">
              <strong>Standard List</strong>
              <span>General fields and estimations</span>
            </div>
          </label>

          <label class="option-card" [class.active]="exportType === 'mtd'">
            <input type="radio" name="exportOption" [(ngModel)]="exportType" value="mtd" />
            <div class="card-icon"><mat-icon>calendar_today</mat-icon></div>
            <div class="card-text">
              <strong>Month-to-Date (MTD)</strong>
              <span>Current month booking hours</span>
            </div>
          </label>

          <label class="option-card" [class.active]="exportType === 'ytd'">
            <input type="radio" name="exportOption" [(ngModel)]="exportType" value="ytd" />
            <div class="card-icon"><mat-icon>date_range</mat-icon></div>
            <div class="card-text">
              <strong>Fiscal YTD</strong>
              <span>Cumulative monthly hours</span>
            </div>
          </label>

          <label class="option-card" [class.active]="exportType === 'fy'">
            <input type="radio" name="exportOption" [(ngModel)]="exportType" value="fy" />
            <div class="card-icon"><mat-icon>event_note</mat-icon></div>
            <div class="card-text">
              <strong>Full Fiscal Year (FY)</strong>
              <span>Full year monthly breakdowns</span>
            </div>
          </label>
        </div>

        <div class="year-select-wrapper" *ngIf="exportType === 'fy'">
          <label for="fySelect">Select Fiscal Year:</label>
          <select id="fySelect" [(ngModel)]="selectedYear" class="fy-select-input">
            <option *ngFor="let year of years" [value]="year">FY {{ year }}</option>
          </select>
        </div>
      </div>

      <div class="dialog-actions">
        <button type="button" class="btn-cancel" mat-dialog-close>Cancel</button>
        <button type="button" class="btn-export" (click)="onExport()">
          <mat-icon>download</mat-icon>
          <span>Generate Excel</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .export-dialog-container {
      padding: 24px;
      color: #0f172a;
      font-family: inherit;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
      }
      .header-icon {
        color: #ea580c;
      }
    }
    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      .subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .option-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      input[type="radio"] {
        position: absolute;
        top: 12px;
        right: 12px;
        accent-color: #ea580c;
      }
      .card-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #fff7ed;
        color: #ea580c;
        display: grid;
        place-items: center;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
      .card-text {
        display: flex;
        flex-direction: column;
        strong {
          font-size: 13px;
          color: #0f172a;
        }
        span {
          font-size: 11px;
          color: #64748b;
        }
      }
      &:hover {
        border-color: #fdba74;
      }
      &.active {
        border-color: #ea580c;
        background: #fffaf5;
        .card-icon {
          background: #ea580c;
          color: #ffffff;
        }
      }
    }
    .year-select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      label {
        font-size: 12px;
        font-weight: 700;
        color: #475569;
      }
      .fy-select-input {
        height: 38px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        padding: 0 12px;
        font-size: 13px;
        outline: none;
        &:focus {
          border-color: #ea580c;
        }
      }
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      button {
        height: 38px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 16px;
      }
      .btn-cancel {
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #64748b;
      }
      .btn-export {
        border: none;
        background: #ea580c;
        color: #ffffff;
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }
  `]
})
export class ProjectExportDialog {
  exportType = 'standard';
  selectedYear = 2026;
  years = [2027, 2026, 2025, 2024];

  constructor(public dialogRef: MatDialogRef<ProjectExportDialog>) {}

  onExport(): void {
    this.dialogRef.close({
      exportType: this.exportType,
      year: this.exportType === 'fy' ? this.selectedYear : undefined
    });
  }
}
