import { NgModule, APP_INITIALIZER, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { CoreModule } from './core/core-module';
import { angularZoneInterceptor } from './core/interceptors/angular-zone-interceptor';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { LayoutModule } from './layout/layout-module';
import { SharedModule } from './shared/shared.module';
import { AuthService } from './core/services/auth';

function appInitializer(authService: AuthService, platformId: any) {
  return () => {
    const finalize = () => {
      authService.setReady();
      return Promise.resolve(true);
    };

    // If we are on the server, we NEVER set ready. 
    // This forces the server to render the loading/splash screen.
    if (!isPlatformBrowser(platformId)) {
      return Promise.resolve(true);
    }

    // If we have a token and it's NOT expired, we can proceed immediately
    if (authService.isAuthenticated()) {
      finalize();
      return Promise.resolve(true);
    }

    // If we have a refresh token, we MUST wait for the refresh to complete before finalizing
    if (authService.getRefreshToken()) {
      return new Promise((resolve) => {
        authService.refreshAccessToken()
          .pipe(
            timeout(8000),
            catchError(() => of(null))
          )
          .subscribe(() => {
            finalize();
            resolve(true);
          });
      });
    }
    
    finalize();
    return Promise.resolve(true);
  };
}

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    AppRoutingModule,
    CoreModule,
    SharedModule,
    LayoutModule,
  ],
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, angularZoneInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializer,
      deps: [AuthService, PLATFORM_ID],
      multi: true
    }
  ],
  bootstrap: [App],
})
export class AppModule {}
