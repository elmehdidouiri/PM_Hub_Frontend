import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const angularZoneInterceptor: HttpInterceptorFn = (req, next) => {
  const zone = inject(NgZone);

  return new Observable<HttpEvent<unknown>>((observer) => {
    const subscription = next(req).subscribe({
      next: (event) => zone.run(() => observer.next(event)),
      error: (error) => zone.run(() => observer.error(error)),
      complete: () => zone.run(() => observer.complete()),
    });

    return () => subscription.unsubscribe();
  });
};
