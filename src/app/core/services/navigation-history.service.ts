import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { StorageService } from './storage.service';

/** Keeps in-app return navigation predictable, including query parameters. */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly storageKey = 'pmhub.navigation-history';
  private readonly maxEntries = 25;
  private readonly isBrowser: boolean;
  private history: string[] = [];
  private started = false;
  private skipNextUrl: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly router: Router,
    private readonly storage: StorageService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  start(): void {
    if (!this.isBrowser || this.started) {
      return;
    }

    this.started = true;
    const currentUrl = this.router.url;
    const savedHistory = this.storage.getItem<string[]>(this.storageKey);
    this.history = Array.isArray(savedHistory) ? savedHistory.filter((url) => this.isSafeUrl(url)) : [];

    if (this.history[this.history.length - 1] !== currentUrl) {
      this.history = this.isSafeUrl(currentUrl) ? [currentUrl] : [];
      this.persist();
    }

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.record(event.urlAfterRedirects));
  }

  back(fallbackUrl: string): Promise<boolean> {
    const previousUrl = this.history.length > 1 ? this.history[this.history.length - 2] : null;

    if (!previousUrl || !this.isSafeUrl(previousUrl)) {
      return this.router.navigateByUrl(fallbackUrl);
    }

    this.history.pop();
    this.persist();
    this.skipNextUrl = previousUrl;
    return this.router.navigateByUrl(previousUrl);
  }

  clear(): void {
    this.history = [];
    this.storage.removeItem(this.storageKey);
  }

  private record(url: string): void {
    if (!this.isSafeUrl(url)) {
      return;
    }

    if (this.skipNextUrl === url) {
      this.skipNextUrl = null;
      return;
    }

    if (this.history[this.history.length - 1] !== url) {
      this.history = [...this.history, url].slice(-this.maxEntries);
      this.persist();
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, this.history);
  }

  private isSafeUrl(url: unknown): url is string {
    return typeof url === 'string' && url.length > 1 && url.startsWith('/') && !url.startsWith('/auth');
  }
}
