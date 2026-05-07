import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ChartBar } from '../../services/dashboard-calculation.service';

/**
 * ChartBarComponent – SRP: renders a single horizontal bar chart list with a header.
 * All data arrives via @Input; no side-effects or API calls.
 */
@Component({
  selector: 'pm-chart-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="chart-container glass-card">
      <div class="chart-header" *ngIf="title">
        <h3>{{ title }}</h3>
        <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
      </div>
      
      <div class="chart-bar-list" [class.chart-bar-list--compact]="compact">
        <p class="chart-bar-list__empty" *ngIf="!data || data.length === 0">
          <span class="material-icons">bar_chart</span>
          {{ emptyMessage }}
        </p>
        
        <div class="chart-bar-list__item" *ngFor="let bar of data; trackBy: trackByLabel">
          <div class="chart-bar-list__meta">
            <span class="chart-bar-list__label" [title]="bar.label">{{ bar.label }}</span>
            <span class="chart-bar-list__value">{{ bar.value | number:'1.0-1' }}</span>
          </div>
          <div class="chart-bar-list__track">
            <div
              class="chart-bar-list__fill"
              [style.width.%]="bar.percent"
              [style.background]="color || 'var(--accent, #f47c00)'">
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./chart-bar.component.scss'],
})
export class ChartBarComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() data: ChartBar[] = [];
  @Input() color = '';
  @Input() compact = false;
  @Input() emptyMessage = 'No data available';

  trackByLabel(_: number, bar: ChartBar): string {
    return bar.label;
  }
}
