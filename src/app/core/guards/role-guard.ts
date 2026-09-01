import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from '../services/auth';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  return authService.isReady$.pipe(
    filter((ready) => ready),
    take(1),
    map(() => {
      if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: state.url },
        });
      }

      const adminOnly = route.data?.['adminOnly'] === true;
      if (adminOnly && !authService.isAdmin()) {
        return router.createUrlTree(['/dashboard']);
      }

      const userOnly = route.data?.['userOnly'] === true;
      if (userOnly && authService.isAdmin()) {
        return router.createUrlTree(['/dashboard']);
      }

      return true;
    })
  );
};
