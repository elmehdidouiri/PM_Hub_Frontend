import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyResetCodeRequest,
  VerifyResetCodeResponse,
} from '../models';

/**
 * AuthApiService is responsible only for communicating with the backend authentication endpoints.
 * It does NOT contain any UI logic, token storage, or session handling – those responsibilities are
 * delegated to dedicated services (TokenStoreService, SessionService, etc.).
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, credentials);
  }

  register(data: RegisterRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register`, data);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/forgot-password`, data);
  }

  verifyResetCode(data: VerifyResetCodeRequest): Observable<ApiResponse<VerifyResetCodeResponse | string>> {
    return this.http.post<ApiResponse<VerifyResetCodeResponse | string>>(
      `${this.apiUrl}/verify-reset-code`,
      data,
    );
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/reset-password`, data);
  }
}
