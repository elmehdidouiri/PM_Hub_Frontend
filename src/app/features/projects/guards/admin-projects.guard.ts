import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take, switchMap, of } from 'rxjs';

import { AuthService } from '../../../core/services/auth';

/** Create / edit projects — administrators only. */
export const projectManagementAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Use the observable and filter/take to wait for the app to be ready
  return authService.isReady$.pipe(
    filter(ready => ready === true),
    take(1),
    switchMap(() => {
      // 1. If we are already authenticated and admin, let them in immediately
      if (authService.isAuthenticated() && authService.isAdmin()) {
        return of(true);
      }

      // 2. SMART WAIT: If we have a refresh token but are not yet authenticated (or admin check pending),
      // we WAIT for the currentUser$ to emit a valid user before deciding.
      if (authService.getRefreshToken()) {
        return authService.currentUser$.pipe(
          filter(user => user !== null), // Wait for user to be loaded from refresh
          take(1),
          map((user) => {
            if (authService.isAdmin(user)) return true;
            // Only redirect to /projects if they are definitely NOT an admin after refresh
            return router.createUrlTree(['/projects']);
          })
        );
      }

      // 3. No refresh token and not authenticated -> the root AuthGuard will handle login redirect,
      // but here we redirect to the safe list as a fallback.
      return of(router.createUrlTree(['/projects']));
    })
  );
};

/** @deprecated Use projectManagementAdminGuard */
export const adminProjectsGuard = projectManagementAdminGuard;
