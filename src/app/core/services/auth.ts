import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, throwError, combineLatest } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';
import { UserSessionService } from './user-session.service';
import { TokenStoreService } from './token-store.service';
import { NavigationHistoryService } from './navigation-history.service';
import {
  ApiResponse,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
  VerifyResetCodeRequest,
  VerifyResetCodeResponse
} from '../models';

const ADMIN_ROLES = new Set([
  'admin',
  'administrator',
  'administrateur',
  'super admin',
  'superadmin',
  'super administrateur',
]);

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly legacyTokenExpirationKey = 'pmhub_token_expiration';
  private readonly legacyStorageKeys = [
    'pmhub_user',
    'currentUser',
    'authToken',
    'authtoken',
    'pmhubtoken',
    'pmhubToken',
    'projectDashboardPreferences',
    '--projectDashboardPreferences',
  ];
  private apiUrl = `${environment.apiUrl}/auth`;
  private usersApiUrl = `${environment.apiUrl}/users`;
  private refreshHttpClient: HttpClient;
  private refreshRequest$: Observable<AuthResponse> | null = null;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean | null>(null);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private readonly isReadySubject = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isReadySubject.asObservable();

  private readonly isInitializingSubject = new BehaviorSubject<boolean>(true);
  public isInitializing$ = this.isInitializingSubject.asObservable();

  private readonly isRefreshingSubject = new BehaviorSubject<boolean>(false);
  public isRefreshing$ = this.isRefreshingSubject.asObservable();

  get isReadyValue(): boolean {
    return this.isReadySubject.value;
  }

  get isInitializing(): boolean {
    return this.isInitializingSubject.value;
  }

  get isRefreshing(): boolean {
    return this.isRefreshingSubject.value;
  }

  get isAuthenticating$(): Observable<boolean> {
    return combineLatest([this.isInitializing$, this.isRefreshing$]).pipe(
      map(([init, refresh]) => init || refresh)
    );
  }

  setReady(): void {
    this.isInitializingSubject.next(false);
    this.isReadySubject.next(true);
  }

  constructor(
    private http: HttpClient,
    httpBackend: HttpBackend,
    private router: Router,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private userSessionService: UserSessionService,
    private tokenStore: TokenStoreService,
    private navigationHistory: NavigationHistoryService,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.refreshHttpClient = new HttpClient(httpBackend);
    
    // Immediate sync from storage to memory store via TokenStoreService
    if (isPlatformBrowser(this.platformId)) {
      this.tokenStore.setAccessToken(this.storageService.getItem(environment.tokenKey));
      this.tokenStore.setRefreshToken(this.storageService.getItem(environment.refreshTokenKey));
    }
    
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    this.storageService.removeItem(this.legacyTokenExpirationKey);
    this.clearLegacyStorage();

    const token = this.getToken();

    if (token && !this.isTokenExpired(token)) {
      const user = this.userSessionService.extractUserFromToken(token);
      this.currentUserSubject.next(user);
      this.userSessionService.setUser(user);
      this.isAuthenticatedSubject.next(true);
    } else {
      if (!this.getRefreshToken()) {
        this.clearAccessTokenData();
      }
    }
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, credentials).pipe(
      map((response) => {
        if (response.success && response.data) {
          return this.applyAuthTokens(response.data);
        }

        throw new Error(response.message || 'Login failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  register(data: RegisterRequest): Observable<User | null> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register`, data).pipe(
      map((response) => {
        if (response.success && response.data) {
          return this.applyAuthTokens(response.data);
        }

        if (response.success) {
          return null;
        }

        throw new Error(response.message || 'Registration failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<string> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/forgot-password`, data).pipe(
      map((response) => {
        if (response.success) {
          return response.message || 'Password recovery instructions have been sent.';
        }

        throw new Error(response.message || 'Password recovery failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  verifyResetCode(data: VerifyResetCodeRequest): Observable<string> {
    return this.http
      .post<ApiResponse<VerifyResetCodeResponse | string>>(`${this.apiUrl}/verify-reset-code`, data)
      .pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Reset code verification failed');
          }

          if (typeof response.data === 'string') {
            return response.data;
          }

          return response.data.resetToken;
        }),
        catchError((error) => this.handleError(error))
      );
  }

  resetPassword(data: ResetPasswordRequest): Observable<string> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/reset-password`, data).pipe(
      map((response) => {
        if (response.success) {
          return response.message || 'Your password has been reset. Please sign in again.';
        }

        throw new Error(response.message || 'Password reset failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  changePassword(data: ChangePasswordRequest): Observable<string> {
    return this.http.put<ApiResponse<unknown>>(`${this.usersApiUrl}/me/password`, data).pipe(
      map((response) => {
        if (response.success) {
          return response.message || 'Your password has been changed successfully.';
        }

        throw new Error(response.message || 'Password change failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getPending(): Observable<unknown[]> {
    return this.http.get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/pending`).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        if (response.success && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError((error) => this.handleError(error))
    );
  }

  approve(payload: { userId: string } | Record<string, unknown>): Observable<void> {
    return this.http.put<ApiResponse<void> | void>(`${this.apiUrl}/approve`, payload).pipe(
      map((response) => {
        if (response === undefined) {
          return;
        }
        if ((response as ApiResponse<void>).success) {
          return;
        }
        const api = response as ApiResponse<void>;
        throw new Error(api.message || 'Approval failed');
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getAuthUserById(id: string): Observable<unknown | null> {
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/users/${encodeURIComponent(id)}`).pipe(
      map((response) => {
        if (typeof response === 'object' && response !== null && 'success' in (response as any)) {
          const api = response as ApiResponse<unknown>;
          return api.success ? (api.data ?? null) : null;
        }
        return response ?? null;
      }),
      catchError((error) => this.handleError(error))
    );
  }

  applyAuthTokens(authData: AuthResponse): User {
    const user: User = {
      userId: authData.userId,
      firstName: authData.firstName,
      lastName: authData.lastName,
      email: authData.email,
      roleName: authData.roleName,
      isAdmin: authData.isAdmin
    };

    this.storageService.setItem(environment.tokenKey, authData.token);
    this.tokenStore.setAccessToken(authData.token);

    if (authData.refreshToken) {
      this.storageService.setItem(environment.refreshTokenKey, authData.refreshToken);
      this.tokenStore.setRefreshToken(authData.refreshToken);
    }

    this.currentUserSubject.next(user);
    this.userSessionService.setUser(user);
    this.isAuthenticatedSubject.next(true);

    return user;
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('Refresh token missing'));
    }

    if (this.isTokenExpired(refreshToken)) {
      this.clearAuthData();
      return throwError(() => new Error('Refresh token expired'));
    }

    if (!this.refreshRequest$) {
      this.isRefreshingSubject.next(true);
      this.refreshRequest$ = this.refreshHttpClient
        .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/refresh`, { refreshToken })
        .pipe(
          map((response) => {
            if (response.success && response.data) {
              this.applyAuthTokens(response.data);
              return response.data;
            }

            throw new Error(response.message || 'Token refresh failed');
          }),
          catchError((err) => {
            this.clearAuthData(); // Clear everything: access token AND refresh token
            return throwError(() => err);
          }),
          finalize(() => {
            this.refreshRequest$ = null;
            this.isRefreshingSubject.next(false);
          }),
          shareReplay(1)
        );
    }

    return this.refreshRequest$;
  }

  logout(): void {
    const currentUrl = this.router.url;
    const returnUrl = currentUrl.includes('/auth/') ? '/dashboard' : currentUrl;
    
    this.clearAuthData();
    this.notificationService.showInfo('You have been logged out');
    
    if (!currentUrl.includes('/auth/login')) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
    }
  }

  sessionExpiredLogout(): void {
    const currentUrl = this.router.url;
    const returnUrl = currentUrl.includes('/auth/') ? '/dashboard' : currentUrl;
    
    this.clearAuthData();
    this.notificationService.showInfo('Your session has expired. Please sign in again.');
    
    if (!currentUrl.includes('/auth/login')) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
    }
  }

  clearInvalidSession(): void {
    const returnUrl = this.router.url;
    this.clearAuthData();
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  }

  private clearAuthData(): void {
    this.navigationHistory.clear();
    this.clearAccessTokenData();
    this.storageService.removeItem(environment.refreshTokenKey);
    this.tokenStore.setRefreshToken(null);
  }

  private clearAccessTokenData(): void {
    this.storageService.removeItem(environment.tokenKey);
    this.clearLegacyStorage();
    this.tokenStore.setAccessToken(null);

    this.currentUserSubject.next(null);
    this.userSessionService.clear();
    this.isAuthenticatedSubject.next(false);
  }

  getToken(): string | null {
    const memToken = this.tokenStore.accessToken;
    if (memToken) return memToken;

    if (!isPlatformBrowser(this.platformId)) return null;
    const storeToken = this.storageService.getItem<string>(environment.tokenKey);
    this.tokenStore.setAccessToken(storeToken);
    return storeToken;
  }

  getRefreshToken(): string | null {
    const memToken = this.tokenStore.refreshToken;
    if (memToken) return memToken;

    if (!isPlatformBrowser(this.platformId)) return null;
    const storeToken = this.storageService.getItem<string>(environment.refreshTokenKey);

    if (!storeToken) {
      return null;
    }

    if (this.isTokenExpired(storeToken)) {
      this.storageService.removeItem(environment.refreshTokenKey);
      this.tokenStore.setRefreshToken(null);
      return null;
    }

    this.tokenStore.setRefreshToken(storeToken);
    return storeToken;
  }

  private clearLegacyStorage(): void {
    this.legacyStorageKeys.forEach((key) => this.storageService.removeItem(key));
  }

  getCurrentUser(): User | null {
    return this.userSessionService.getUser() ?? this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && !this.isTokenExpired(token);
  }

  isAdmin(userToCheck?: User | null): boolean {
    let user = userToCheck ?? this.getCurrentUser();
    
    if (!user) {
      const token = this.getToken();
      if (token) {
        user = this.userSessionService.extractUserFromToken(token);
      }
    }

    if (!user) {
      return false;
    }

    if (user?.isAdmin) {
      return true;
    }
    const role = (user.roleName || '').trim().toLowerCase();
    return ADMIN_ROLES.has(role);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const expirationDate = new Date(this.getExpirationFromToken(token));
      const bufferMs = 10000;
      return expirationDate.getTime() < (new Date().getTime() + bufferMs);
    } catch {
      return true;
    }
  }

  private getExpirationFromToken(token: string): string {
    const decoded: { exp?: number } = jwtDecode(token);

    if (!decoded.exp) {
      throw new Error('Token expiration claim is missing');
    }

    return new Date(decoded.exp * 1000).toISOString();
  }

  private handleError(error: any): Observable<never> {
    let errorMessages: string[] = [];

    if (error.error && error.error.errors) {
      errorMessages = error.error.errors;
    } else if (error.error && error.error.message) {
      errorMessages = [error.error.message];
    } else if (error.message) {
      errorMessages = [error.message];
    } else {
      errorMessages = ['An unexpected error occurred'];
    }

    this.notificationService.showErrorDialog('Authentication error', errorMessages);

    return throwError(() => error);
  }
}
