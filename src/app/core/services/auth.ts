import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';
import { UserSessionService } from './user-session.service';
import {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User
} from '../models';

/**
 * Memory-based store to prevent flicker and handle SSR hydration issues.
 * Storing the token in a static class ensures it's available instantly.
 */
export class AuthStore {
  private static _token: string | null = null;
  private static _refreshToken: string | null = null;

  static getToken(): string | null {
    return this._token;
  }

  static setToken(token: string | null): void {
    this._token = token;
  }

  static getRefreshToken(): string | null {
    return this._refreshToken;
  }

  static setRefreshToken(token: string | null): void {
    this._refreshToken = token;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly legacyTokenExpirationKey = 'pmhub_token_expiration';
  private apiUrl = `${environment.apiUrl}/auth`;
  private refreshHttpClient: HttpClient;
  private refreshRequest$: Observable<AuthResponse> | null = null;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean | null>(null);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private readonly isReadySubject = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isReadySubject.asObservable();

  get isReadyValue(): boolean {
    return this.isReadySubject.value;
  }

  setReady(): void {
    this.isReadySubject.next(true);
  }

  constructor(
    private http: HttpClient,
    httpBackend: HttpBackend,
    private router: Router,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private userSessionService: UserSessionService,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.refreshHttpClient = new HttpClient(httpBackend);
    
    // Immediate sync from storage to memory store
    if (isPlatformBrowser(this.platformId)) {
      AuthStore.setToken(this.storageService.getItem(environment.tokenKey));
      AuthStore.setRefreshToken(this.storageService.getItem(environment.refreshTokenKey));
    }
    
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    this.storageService.removeItem(this.legacyTokenExpirationKey);

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
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/users/${id}`).pipe(
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
    AuthStore.setToken(authData.token);

    if (authData.refreshToken) {
      this.storageService.setItem(environment.refreshTokenKey, authData.refreshToken);
      AuthStore.setRefreshToken(authData.refreshToken);
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
            this.clearAccessTokenData();
            return throwError(() => err);
          }),
          finalize(() => {
            this.refreshRequest$ = null;
          }),
          shareReplay(1)
        );
    }

    return this.refreshRequest$;
  }

  logout(): void {
    const returnUrl = this.router.url;
    this.clearAuthData();
    this.notificationService.showInfo('Vous avez ete deconnecte');
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  }

  sessionExpiredLogout(): void {
    const returnUrl = this.router.url;
    this.clearAuthData();
    this.notificationService.showInfo('Votre session a expire. Veuillez vous reconnecter.');
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  }

  clearInvalidSession(): void {
    const returnUrl = this.router.url;
    this.clearAuthData();
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  }

  private clearAuthData(): void {
    this.clearAccessTokenData();
    this.storageService.removeItem(environment.refreshTokenKey);
    AuthStore.setRefreshToken(null);
  }

  private clearAccessTokenData(): void {
    this.storageService.removeItem(environment.tokenKey);
    AuthStore.setToken(null);

    this.currentUserSubject.next(null);
    this.userSessionService.clear();
    this.isAuthenticatedSubject.next(false);
  }

  getToken(): string | null {
    const memToken = AuthStore.getToken();
    if (memToken) return memToken;

    if (!isPlatformBrowser(this.platformId)) return null;
    const storeToken = this.storageService.getItem<string>(environment.tokenKey);
    AuthStore.setToken(storeToken);
    return storeToken;
  }

  getRefreshToken(): string | null {
    const memToken = AuthStore.getRefreshToken();
    if (memToken) return memToken;

    if (!isPlatformBrowser(this.platformId)) return null;
    const storeToken = this.storageService.getItem<string>(environment.refreshTokenKey);

    if (!storeToken) {
      return null;
    }

    if (this.isTokenExpired(storeToken)) {
      this.storageService.removeItem(environment.refreshTokenKey);
      AuthStore.setRefreshToken(null);
      return null;
    }

    AuthStore.setRefreshToken(storeToken);
    return storeToken;
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

    if (user.isAdmin === true) {
      return true;
    }
    const role = (user.roleName || '').trim().toLowerCase();
    const adminRoles = new Set([
      'admin',
      'administrator',
      'administrateur',
      'super admin',
      'superadmin',
      'super administrateur',
    ]);
    return adminRoles.has(role);
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
