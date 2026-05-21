import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface PendingUserDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveUserDto {
  userId: string;
  isApproved: boolean;
  roleId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApprovalsApiService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  getPendingUsers(): Observable<PendingUserDto[]> {
    return this.http
      .get<ApiResponse<PendingUserDto[]>>(`${this.baseUrl}/pending`)
      .pipe(
        map((response) => {
          if (response && 'data' in response && Array.isArray(response.data)) {
            return response.data;
          }
          return Array.isArray(response) ? (response as unknown as PendingUserDto[]) : [];
        })
      );
  }

  approveUser(payload: ApproveUserDto): Observable<void> {
    return this.http
      .put<ApiResponse<void> | void>(`${this.baseUrl}/approve`, payload)
      .pipe(map(() => void 0));
  }
}
