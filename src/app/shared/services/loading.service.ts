import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _isLoading = signal(false);
  private _message = signal('Loading data...');

  isLoading = this._isLoading.asReadonly();
  message = this._message.asReadonly();

  show(message?: string) {
    if (message) this._message.set(message);
    this._isLoading.set(true);
  }

  hide() {
    this._isLoading.set(false);
    this._message.set('Loading data...');
  }
}
