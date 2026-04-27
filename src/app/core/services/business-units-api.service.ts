import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, ReferenceItem } from '../models';
import { UnknownRecord } from './users-api.service';

@Injectable({ providedIn: 'root' })
export class BusinessUnitsApiService {
  private readonly apiUrl = `${environment.apiUrl}/businessunits`;

  constructor(private readonly http: HttpClient) {}

  create(payload: UnknownRecord): Observable<unknown | null> {
    return this.http.post<ApiResponse<unknown> | unknown>(this.apiUrl, payload).pipe(map((r) => this.unwrapItem(r)));
  }

  list(): Observable<unknown[]> {
    return this.http.get<ApiResponse<unknown[]> | unknown[]>(this.apiUrl).pipe(map((r) => this.unwrapList(r)));
  }

  get(id: string): Observable<unknown | null> {
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`).pipe(map((r) => this.unwrapItem(r)));
  }

  update(id: string, payload: UnknownRecord): Observable<unknown | null> {
    return this.http.put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${id}`, payload).pipe(map((r) => this.unwrapItem(r)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${id}`).pipe(map((r) => this.unwrapVoid(r)));
  }

  listItems(): Observable<ReferenceItem[]> {
    return this.list().pipe(map((items) => items.map((item) => this.toReferenceItem(item)).filter((x) => !!x.id && !!x.name)));
  }

  createItem(payload: { name: string; description?: string }): Observable<ReferenceItem | null> {
    return this.create(payload as UnknownRecord).pipe(map((item) => (item ? this.toReferenceItem(item) : null)));
  }

  updateItem(id: string, payload: { name: string; description?: string }): Observable<ReferenceItem | null> {
    return this.update(id, payload as UnknownRecord).pipe(map((item) => (item ? this.toReferenceItem(item) : null)));
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown | null {
    if (this.isApiResponse(response)) {
      return response.success ? (response.data ?? null) : null;
    }
    return response ?? null;
  }

  private unwrapVoid(response: ApiResponse<void> | void): void {
    if (response === undefined) return;
    if (this.isApiResponse(response) && response.success) return;
    if (this.isApiResponse(response)) throw new Error(response.message || 'Request failed');
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }

  private toReferenceItem(value: unknown): ReferenceItem {
    const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const id =
      (record['id'] as string) ||
      (record['businessUnitId'] as string) ||
      (record['businessUnitID'] as string) ||
      '';
    const name = (record['name'] as string) || (record['label'] as string) || '';
    return {
      id,
      name,
      description: (record['description'] as string) || undefined,
    };
  }
}

