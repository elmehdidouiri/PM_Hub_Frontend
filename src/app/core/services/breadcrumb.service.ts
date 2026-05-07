import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  private customLabels = new Map<string, string>();
  public updates = signal<number>(0);

  setLabel(segment: string, label: string): void {
    this.customLabels.set(segment, label);
    this.updates.update(n => n + 1);
  }

  getLabel(segment: string): string | null {
    return this.customLabels.get(segment) || null;
  }
}
