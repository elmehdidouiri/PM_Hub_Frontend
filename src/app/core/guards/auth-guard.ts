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
    map(() => {
      // 1. If definitively authenticated, we are good.
      if (authService.isAuthenticated()) {
        return true;
      }

      // 2. If we are currently in a refresh cycle (triggered by an interceptor for example),
      // we allow the route to proceed to avoid interrupting the flow.
      // The splash screen in app.html will keep the UI hidden.
      if (authService.isRefreshing) {
        return true;
      }

      // 3. If we are NOT authenticated and NOT refreshing, we must check if we CAN refresh.
      // If we have a refresh token, it means the APP_INITIALIZER might have failed 
      // but the token is still there? No, we clear it on failure now.
      // So if it's still there, we might want to let it try one more time?
      // No, let's be strict: if not authenticated and not refreshing -> Redirect.
      
      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
    })
  );
};
