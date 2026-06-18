import { Component, signal,OnInit  } from '@angular/core';
import { AuthService } from './core/services/auth';
import { User } from './core/models';


@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  protected readonly title = signal('pmhub-frontend');

   user = signal<User | null>(null);

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Initialize the user from the service
    this.user.set(this.authService.getCurrentUser());

    // Écouter les changements (login/logout)
    this.authService.currentUser$.subscribe(u => this.user.set(u));
  }

  get isReady$() {
    return this.authService.isReady$;
  }

  get isAuthenticating$() {
    return this.authService.isAuthenticating$;
  }

  logout() {
    this.authService.logout();
  }
}
