import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { User } from './core/models';
import { AuthService } from './core/services/auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrls: ['./app.scss']
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('pmhub-frontend');

  user = signal<User | null>(null);
  private readonly subscriptions = new Subscription();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.user.set(this.authService.getCurrentUser());

    this.subscriptions.add(
      this.authService.currentUser$.subscribe((u) => {
        this.user.set(u);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isReady$() {
    return this.authService.isReady$;
  }

  get isAuthenticating$() {
    return this.authService.isAuthenticating$;
  }

  logout(): void {
    this.authService.logout();
  }

}
