import { NgModule, APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { CoreModule } from './core/core-module';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { LayoutModule } from './layout/layout-module';
import { SharedModule } from './shared/shared.module';
import { AuthService } from './core/services/auth';

function appInitializer(authService: AuthService) {
  return () => {
    const finalize = () => {
      authService.setReady();
      return Promise.resolve(true);
    };

    if (authService.getRefreshToken()) {
      return new Promise((resolve) => {
        authService.refreshAccessToken()
          .pipe(catchError(() => of(null)))
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
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializer,
      deps: [AuthService],
      multi: true
    }
  ],
  bootstrap: [App],
})
export class AppModule {}
