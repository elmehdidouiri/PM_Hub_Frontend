import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from '../../../core/services/auth';

/** Create / edit projects — administrators only. */
export const projectManagementAdminGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  return authService.isReady$.pipe(
    filter(ready => ready === true),
    take(1),
    map(() => {
      if (authService.isAuthenticated() && authService.isAdmin()) {
        return true;
      }

      if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: state.url },
        });
      }

      return router.createUrlTree(['/projects']);
    })
  );
};

/** @deprecated Use projectManagementAdminGuard */
export const adminProjectsGuard = projectManagementAdminGuard;
