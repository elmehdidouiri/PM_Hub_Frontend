import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Role } from '../models';
import { UnknownRecord } from './users-api.service';

@Injectable({
  providedIn: 'root',
})
export class RolesApiService {
  private readonly apiUrl = `${environment.apiUrl}/roles`;

  constructor(private readonly http: HttpClient) {}

  getRoles(): Observable<Role[]> {
    return this.http
      .get<ApiResponse<Role[]> | Role[]>(this.apiUrl)
      .pipe(map((response) => this.unwrapList(response)));
  }

  getRole(id: string): Observable<Role | null> {
    return this.http.get<ApiResponse<Role> | Role>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => item ?? null)
    );
  }

  createRole(payload: UnknownRecord): Observable<Role | null> {
    return this.http.post<ApiResponse<Role> | Role>(this.apiUrl, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => item ?? null)
    );
  }

  updateRole(id: string, payload: UnknownRecord): Observable<Role | null> {
    return this.http.put<ApiResponse<Role> | Role>(`${this.apiUrl}/${id}`, payload).pipe(
      map((response) => this.unwrapItem(response)),
      map((item) => item ?? null)
    );
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        if (response === undefined) return;
        if (this.isApiResponse(response) && response.success) return;
        if (this.isApiResponse(response)) {
          throw new Error(response.message || 'Unable to delete role');
        }
        return;
      })
    );
  }

  private unwrapList(response: ApiResponse<Role[]> | Role[]): Role[] {
    if (Array.isArray(response)) return response;
    if (response.success && response.data) return response.data;
    return [];
  }

  private unwrapItem(response: ApiResponse<Role> | Role): Role | null {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }
    return response ?? null;
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }
}

