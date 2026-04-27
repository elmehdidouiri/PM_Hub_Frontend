import { inject } from '@angular/core';
import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth';
import { StorageService } from '../services/storage.service';

const AUTH_REFRESH_RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const storageService = inject(StorageService);
  const token = storageService.getItem<string>(environment.tokenKey);
  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isRefreshRequest = req.url === `${environment.apiUrl}/auth/refresh`;
  const isAuthRequest =
    req.url === `${environment.apiUrl}/auth/login` || req.url === `${environment.apiUrl}/auth/register`;

  if (!isApiRequest || isRefreshRequest || isAuthRequest) {
    return next(req);
  }

  const requestWithToken = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(requestWithToken).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || req.context.get(AUTH_REFRESH_RETRIED)) {
        return throwError(() => error);
      }

      if (!authService.getRefreshToken()) {
        // Only redirect if we are not in the middle of an initial load
        if (authService.isReadyValue) {
          authService.sessionExpiredLogout();
        }
        return throwError(() => error);
      }

      return authService
        .refreshAccessToken()
        .pipe(
          switchMap((response) => {
            return next(
              req.clone({
                context: req.context.set(AUTH_REFRESH_RETRIED, true),
                setHeaders: {
                  Authorization: `Bearer ${response.token}`,
                },
              })
            );
          }),
          catchError((refreshError) => {
            if (authService.isReadyValue) {
              authService.sessionExpiredLogout();
            }
            return throwError(() => refreshError);
          })
        );
    })
  );
};
