import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

import { User } from '../models';

@Injectable({
  providedIn: 'root',
})
export class UserSessionService {
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  setUser(user: User | null): void {
    this.userSubject.next(user);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  clear(): void {
    this.userSubject.next(null);
  }

  extractUserFromToken(token: string): User | null {
    try {
      const claims = jwtDecode<Record<string, unknown>>(token);
      const userId = this.readClaim(claims, ['nameid', 'sub', 'userId', 'uid']);
      if (!userId) {
        return null;
      }

      const firstName = this.readClaim(claims, ['given_name', 'firstName', 'firstname']) || '';
      const lastName = this.readClaim(claims, ['family_name', 'lastName', 'lastname']) || '';
      const email = this.readClaim(claims, ['email', 'upn']) || '';
      const roleName = this.readClaim(claims, ['role', 'roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) || 'User';
      const isAdmin = this.readBooleanClaim(claims, ['isAdmin']) || this.normalizeRole(roleName).includes('admin');

      return {
        userId,
        firstName,
        lastName,
        email,
        roleName,
        isAdmin,
      };
    } catch {
      return null;
    }
  }

  private readClaim(claims: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = claims[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return String(value[0]).trim();
      }
    }
    return '';
  }

  private readBooleanClaim(claims: Record<string, unknown>, keys: string[]): boolean {
    for (const key of keys) {
      const value = claims[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
    }
    return false;
  }

  private normalizeRole(role: string): string {
    return role.trim().toLowerCase();
  }
}
