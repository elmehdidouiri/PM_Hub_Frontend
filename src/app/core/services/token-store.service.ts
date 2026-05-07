import { Injectable } from '@angular/core';

/**
 * Service responsible for storing authentication tokens in memory.
 * This decouples token storage from AuthService, making it easier to mock
 * in tests and adhering to the Single Responsibility Principle.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenStoreService {
  private _token: string | null = null;
  private _refreshToken: string | null = null;

  get accessToken(): string | null {
    return this._token;
  }

  setAccessToken(value: string | null): void {
    this._token = value;
  }

  get refreshToken(): string | null {
    return this._refreshToken;
  }

  setRefreshToken(value: string | null): void {
    this._refreshToken = value;
  }
}
