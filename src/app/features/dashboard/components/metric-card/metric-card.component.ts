import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * MetricCardComponent – SRP: only displays a single KPI card.
 * Receives data via @Input, has no business logic.
 */
@Component({
  selector: 'pm-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="metric-card" [attr.data-tone]="tone">
      <div class="metric-card__icon-wrap">
        <span class="material-icons">{{ icon }}</span>
      </div>
      <div class="metric-card__body">
        <p class="metric-card__label">{{ label }}</p>
        <p class="metric-card__value">{{ value }}</p>
        
        <div class="metric-card__progress-wrap" *ngIf="progress !== undefined">
          <div class="metric-card__progress-bar" [style.width.%]="progress"></div>
        </div>

        <p class="metric-card__note">
          <span *ngIf="delta !== undefined" class="metric-card__delta"
                [class.metric-card__delta--up]="delta > 0"
                [class.metric-card__delta--down]="delta < 0">
            {{ delta > 0 ? '▲' : '▼' }} {{ delta | number:'1.1-1' }}
          </span>
          {{ note }}
        </p>
      </div>
    </div>
  `,
  styleUrls: ['./metric-card.component.scss'],
})
export class MetricCardComponent {
  @Input() label = '';
  @Input() value: string | number | null = '';
  @Input() note = '';
  @Input() icon = 'bar_chart';
  @Input() tone?: string = '';
  @Input() delta?: number;
  @Input() progress?: number;
}
