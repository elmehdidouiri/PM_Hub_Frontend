import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';

import { AuthService } from '../services/auth';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const returnUrl = route.queryParams['returnUrl'] || '/dashboard';

  return authService.isReady$.pipe(
    filter(ready => ready === true),
    take(1),
    map(() => {
      // If NOT authenticated, allow access to login/register
      if (!authService.isAuthenticated()) {
        return true;
      }

      // If authenticated, redirect to dashboard or returnUrl
      // Safe check: if returnUrl points to login, go to dashboard instead
      const safeReturnUrl = returnUrl.includes('/auth/login') ? '/dashboard' : returnUrl;
      return router.parseUrl(safeReturnUrl);
    })
  );
};
