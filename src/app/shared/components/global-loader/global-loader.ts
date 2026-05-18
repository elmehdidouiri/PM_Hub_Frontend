import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule, LoadingSpinner],
  template: `
    <app-loading-spinner 
      *ngIf="loadingService.isLoading()" 
      [message]="loadingService.message()"
      [fullPage]="true">
    </app-loading-spinner>
  `
})
export class GlobalLoaderComponent {
  protected readonly loadingService = inject(LoadingService);
}
