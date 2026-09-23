import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface CompanyTargetSettings {
  id?: string;
  hoursPerDay: number;
  annualHoursTarget: number;
  workingDaysPerMonth: number;
  fiscalYearStartMonth: number;
  monthlyHoursTarget: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyTargetSettingsPayload {
  hoursPerDay: number;
  annualHoursTarget: number;
  workingDaysPerMonth: number;
  fiscalYearStartMonth: number;
}

export interface KpiTargetSetting {
  id: string;
  name: string;
  description?: string;
  targetValue: number;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KpiTargetSettingPayload {
  name: string;
  description?: string;
  targetValue: number;
  displayOrder: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AdminTargetSettingsApiService {
  private readonly apiUrl = `${environment.apiUrl}/admin/target-settings`;

  constructor(private readonly http: HttpClient) {}

  getCompanySettings(): Observable<CompanyTargetSettings> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/company`)
      .pipe(map((response) => this.toCompanySettings(this.unwrapItem(response))));
  }

  updateCompanySettings(payload: CompanyTargetSettingsPayload): Observable<CompanyTargetSettings> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/company`, payload)
      .pipe(map((response) => this.toCompanySettings(this.unwrapItem(response))));
  }

  getKpis(includeInactive = true): Observable<KpiTargetSetting[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/kpis`, {
        params: { includeInactive },
      })
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toKpi(item))));
  }

  /**
   * Read the KPI targets used as references in dashboards.
   * This intentionally omits the optional includeInactive query parameter.
   */
  getActiveKpis(): Observable<KpiTargetSetting[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/kpis`)
      .pipe(map((response) => this.unwrapList(response).map((item) => this.toKpi(item))));
  }

  getKpi(id: string): Observable<KpiTargetSetting> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/kpis/${encodeURIComponent(id)}`)
      .pipe(map((response) => this.toKpi(this.unwrapItem(response))));
  }

  createKpi(payload: KpiTargetSettingPayload): Observable<KpiTargetSetting> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/kpis`, payload)
      .pipe(map((response) => this.toKpi(this.unwrapItem(response))));
  }

  updateKpi(id: string, payload: KpiTargetSettingPayload): Observable<KpiTargetSetting> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/kpis/${encodeURIComponent(id)}`, payload)
      .pipe(map((response) => this.toKpi(this.unwrapItem(response))));
  }

  deleteKpi(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void> | void>(`${this.apiUrl}/kpis/${encodeURIComponent(id)}`)
      .pipe(map((response) => this.unwrapVoid(response)));
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (this.isApiResponse(response) && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    if (this.isApiResponse(response) && !response.success) {
      throw new Error(response.message || 'Unable to load target settings.');
    }
    if (this.hasDataList(response)) {
      return response.data;
    }
    return [];
  }

  private unwrapItem(response: ApiResponse<unknown> | unknown): unknown {
    if (this.isApiResponse(response)) {
      if (response.success) {
        return response.data ?? {};
      }
      throw new Error(response.message || 'Target settings request failed.');
    }
    return response ?? {};
  }

  private unwrapVoid(response: ApiResponse<void> | void): void {
    if (response === undefined) {
      return;
    }
    if (this.isApiResponse(response) && response.success) {
      return;
    }
    if (this.isApiResponse(response)) {
      throw new Error(response.message || 'Unable to delete KPI target.');
    }
  }

  private toCompanySettings(value: unknown): CompanyTargetSettings {
    const record = this.asRecord(value);
    return {
      id: this.str(record, ['id', 'Id']),
      hoursPerDay: this.num(record, ['hoursPerDay', 'HoursPerDay'], 8),
      annualHoursTarget: this.num(record, ['annualHoursTarget', 'AnnualHoursTarget'], 0),
      workingDaysPerMonth: this.num(record, ['workingDaysPerMonth', 'WorkingDaysPerMonth'], 22),
      fiscalYearStartMonth: this.num(record, ['fiscalYearStartMonth', 'FiscalYearStartMonth'], 1),
      monthlyHoursTarget: this.num(record, ['monthlyHoursTarget', 'MonthlyHoursTarget'], 160),
      createdAt: this.str(record, ['createdAt', 'CreatedAt']),
      updatedAt: this.str(record, ['updatedAt', 'UpdatedAt', 'modifiedAt', 'ModifiedAt']),
    };
  }

  private toKpi(value: unknown): KpiTargetSetting {
    const record = this.asRecord(value);
    const name = this.str(record, ['name', 'Name', 'label', 'Label']);
    return {
      id: this.str(record, ['id', 'Id', 'kpiTargetSettingId', 'KpiTargetSettingId']) || name,
      name: name || 'KPI target',
      description: this.str(record, ['description', 'Description']),
      targetValue: this.num(record, ['targetValue', 'TargetValue', 'target', 'Target'], 0),
      displayOrder: this.num(record, ['displayOrder', 'DisplayOrder', 'order', 'Order'], 0),
      isActive: this.bool(record, ['isActive', 'IsActive', 'active', 'Active'], true),
      createdAt: this.str(record, ['createdAt', 'CreatedAt']),
      updatedAt: this.str(record, ['updatedAt', 'UpdatedAt', 'modifiedAt', 'ModifiedAt']),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private str(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private num(record: Record<string, unknown>, keys: string[], fallback: number): number {
    for (const key of keys) {
      const parsed = Number(record[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private bool(record: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
      }
    }
    return fallback;
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
  }

  private hasDataList(value: unknown): value is { data: unknown[] } {
    return typeof value === 'object'
      && value !== null
      && 'data' in value
      && Array.isArray((value as { data?: unknown }).data);
  }

}
