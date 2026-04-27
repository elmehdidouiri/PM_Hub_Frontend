import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';

import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Use the isReady$ observable to wait until initialization is complete
  return authService.isReady$.pipe(
    filter(ready => ready === true),
    take(1),
    switchMap(() => {
      // SMART CHECK: If we have a refresh token, we allow entry immediately
      // The interceptor or components will handle the "loading" state
      if (authService.isAuthenticated() || authService.getRefreshToken()) {
        return of(true);
      }

      // NO TOKEN AT ALL -> Only then redirect to login
      return of(router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      }));
    })
  );
};
