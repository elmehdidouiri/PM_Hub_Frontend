import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // If the request has the ignore header, bypass interception
  if (req.headers.has('X-Ignore-Error-Interceptor')) {
    // Clone and remove the custom header so it doesn't get sent to the server
    const cleanedReq = req.clone({
      headers: req.headers.delete('X-Ignore-Error-Interceptor')
    });
    return next(cleanedReq);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // Intercept backend-down status codes:
        // - 0 (Connection refused / ECONNREFUSED)
        // - 500 (Internal Server Error)
        // - 502 (Bad Gateway proxy error)
        // - 504 (Gateway Timeout proxy error)
        if (error.status === 0 || error.status === 500 || error.status === 502 || error.status === 504) {
          // Redirect to the custom server offline error page
          router.navigate(['/server-error']);
        }
      }
      return throwError(() => error);
    })
  );
};
