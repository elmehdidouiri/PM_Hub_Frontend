import { Component, inject } from '@angular/core';

import { AuthService } from '../../../../core/services/auth';

@Component({
  selector: 'app-profile-page',
  standalone: false,
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  readonly user = this.authService.getCurrentUser();
}

