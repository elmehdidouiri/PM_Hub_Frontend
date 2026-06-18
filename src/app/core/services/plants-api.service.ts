import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, PlantDto, ReferenceItem } from '../models';
import { UnknownRecord } from './users-api.service';

@Injectable({ providedIn: 'root' })
export class PlantsApiService {
  private readonly apiUrl = `${environment.apiUrl}/plants`;

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
    return this.list()
      .pipe(map((items) => items.map((item) => this.toPlantDto(item)).filter((x) => !!x.id && !!x.name)))
      .pipe(map((items) => items.map((dto) => this.toReferenceItem(dto))));
  }

  listPlants(): Observable<PlantDto[]> {
    return this.list().pipe(map((items) => items.map((item) => this.toPlantDto(item)).filter((x) => !!x.id && !!x.name)));
  }

  createItem(payload: { name: string; description: string }): Observable<ReferenceItem | null> {
    return this.create(payload as UnknownRecord).pipe(map((item) => (item ? this.toReferenceItem(this.toPlantDto(item)) : null)));
  }

  updateItem(id: string, payload: { name: string; description: string }): Observable<ReferenceItem | null> {
    return this.update(id, payload as UnknownRecord).pipe(map((item) => (item ? this.toReferenceItem(this.toPlantDto(item)) : null)));
  }

  listPlantsByBusinessUnit(_businessUnitId: string): Observable<PlantDto[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/businessunit/${_businessUnitId}`)
      .pipe(map((r) => this.unwrapList(r).map((item) => this.toPlantDto(item)).filter((x) => !!x.id && !!x.name)));
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

  private toPlantDto(value: unknown): PlantDto {
    const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      id: (record['id'] as string) || (record['plantId'] as string) || '',
      name: (record['name'] as string) || (record['plantName'] as string) || (record['label'] as string) || '',
      description: (record['description'] as string) || '',
      departmentCount: (record['departmentCount'] as number) || 0,
      createdAt: (record['createdAt'] as string) || '',
      updatedAt: (record['updatedAt'] as string) || null,
    };
  }

  private toReferenceItem(dto: PlantDto): ReferenceItem {
    return { id: dto.id, name: dto.name, description: dto.description || undefined };
  }
}

