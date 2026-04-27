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
    switchMap(() => {
      if (authService.isAuthenticated()) {
        return of(router.parseUrl(returnUrl));
      }

      if (authService.getRefreshToken()) {
        return authService.refreshAccessToken().pipe(
          map((): UrlTree => router.parseUrl(returnUrl)),
          catchError(() => of(true))
        );
      }

      return of(true);
    })
  );
};
