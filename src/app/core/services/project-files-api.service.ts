import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';
import { UnknownRecord } from './users-api.service';

@Injectable({ providedIn: 'root' })
export class ProjectFilesApiService {
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  constructor(private readonly http: HttpClient) {}

  list(projectId: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/files`)
      .pipe(map((r) => (Array.isArray(r) ? r : r.data || [])));
  }

  get(projectId: string, id: string): Observable<unknown | null> {

    
    return this.http.get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/files/${id}`).pipe(
      map((r) => {
        if (typeof r === 'object' && r !== null && 'success' in (r as any)) {
          const api = r as ApiResponse<unknown>;
          return api.success ? (api.data ?? null) : null;
        }
        return r ?? null;
      })
    );
  }

  upload(projectId: string, formData: FormData): Observable<unknown | null> {
    return this.http.post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/files`, formData).pipe(
      map((r) => (typeof r === 'object' && r !== null && 'success' in (r as any) ? (r as ApiResponse<unknown>).data : r) ?? null)
    );
  }

  download(projectId: string, id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${projectId}/files/${id}/download`, { responseType: 'blob' });
  }

  update(projectId: string, id: string, payload: object): Observable<unknown | null> {
    return this.http.put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/files/${id}`, payload).pipe(
      map((r) => (typeof r === 'object' && r !== null && 'success' in (r as any) ? (r as ApiResponse<unknown>).data : r) ?? null)
    );
  }

  listVersions(projectId: string, id: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/files/${id}/versions`)
      .pipe(map((r) => (Array.isArray(r) ? r : r.data || [])));
  }

  uploadVersion(projectId: string, id: string, formData: FormData): Observable<unknown | null> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/files/${id}/versions`, formData)
      .pipe(map((r) => (typeof r === 'object' && r !== null && 'success' in (r as any) ? (r as ApiResponse<unknown>).data : r) ?? null));
  }

  delete(projectId: string, id: string): Observable<void> {
    return this.http.delete<ApiResponse<void> | void>(`${this.apiUrl}/${projectId}/files/${id}`).pipe(
      map((r) => {
        if (r === undefined) return;
        if (typeof r === 'object' && r !== null && 'success' in (r as any) && !(r as ApiResponse<void>).success) {
          throw new Error((r as ApiResponse<void>).message || 'Unable to delete file');
        }
      })
    );
  }

  bulkUpload(projectId: string, formData: FormData): Observable<unknown | null> {
    return this.http.post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/files/bulk`, formData).pipe(
      map((r) => (typeof r === 'object' && r !== null && 'success' in (r as any) ? (r as ApiResponse<unknown>).data : r) ?? null)
    );
  }
}

