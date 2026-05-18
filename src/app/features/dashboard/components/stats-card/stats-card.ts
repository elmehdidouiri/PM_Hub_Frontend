import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stats-card',
  standalone: false,
  templateUrl: './stats-card.html',
  styleUrl: './stats-card.scss',
})
export class StatsCard {
  @Input() title = '';
  @Input() value: string | number = '';
  @Input() subtitle = '';
  @Input() icon = 'analytics';
}
