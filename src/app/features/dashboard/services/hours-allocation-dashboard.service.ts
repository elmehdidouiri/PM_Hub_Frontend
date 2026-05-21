import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models';
import {
  HoursAllocationByProjectDto,
  HoursAllocationByProjectUserDto,
  HoursAllocationByRoleDto,
  HoursAllocationByTeamDto,
  HoursAllocationByUserDto,
  HoursAllocationDashboardDto,
  HoursAllocationDashboardParams,
  HoursAllocationDetailDto,
  HoursAllocationFiltersDto,
  HoursAllocationMonthlyDto,
} from '../models/hours-allocation-dashboard.models';

@Injectable({ providedIn: 'root' })
export class HoursAllocationDashboardService {
  private readonly apiUrl = `${environment.apiUrl}/hours-allocation`;

  constructor(private readonly http: HttpClient) {}

  getFilters(): Observable<HoursAllocationFiltersDto> {
    return this.http
      .get<ApiResponse<HoursAllocationFiltersDto> | HoursAllocationFiltersDto>(`${this.apiUrl}/filters`)
      .pipe(map((response) => this.normalizeFilters(this.unwrap(response))));
  }

  getDashboard(params: HoursAllocationDashboardParams): Observable<HoursAllocationDashboardDto> {
    return this.http
      .get<ApiResponse<HoursAllocationDashboardDto> | HoursAllocationDashboardDto>(`${this.apiUrl}/dashboard`, {
        params: this.buildParams(params),
      })
      .pipe(map((response) => this.normalizeDashboard(this.unwrap(response))));
  }

  sendReminders(params: HoursAllocationDashboardParams): Observable<void> {
    return this.http
      .post<ApiResponse<void> | void>(`${this.apiUrl}/reminders`, params)
      .pipe(map((response) => this.unwrapVoid(response)));
  }

  private buildParams(params: HoursAllocationDashboardParams): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
        httpParams = httpParams.set(`${key.charAt(0).toUpperCase()}${key.slice(1)}`, String(value));
      }
    });
    return httpParams;
  }

  private unwrap<T>(response: ApiResponse<T> | T): T {
    if (this.isApiResponse(response)) {
      if (response.success && response.data !== undefined && response.data !== null) {
        return response.data;
      }
      throw new Error(response.message || 'Unable to load hours allocation data.');
    }

    if (this.isLooseApiResponse(response)) {
      const success = response['success'] ?? response['Success'] ?? response['isSuccess'] ?? response['IsSuccess'];
      const data = response['data'] ?? response['Data'] ?? response['result'] ?? response['Result'];
      if (success === false) {
        throw new Error(String(response['message'] ?? response['Message'] ?? 'Unable to load hours allocation data.'));
      }
      if (data !== undefined && data !== null) {
        return data as T;
      }
    }

    return response;
  }

  private unwrapVoid(response: ApiResponse<void> | void): void {
    if (response === undefined) return;
    if (this.isApiResponse(response) && response.success) return;
    if (this.isApiResponse(response)) throw new Error(response.message || 'Request failed');
  }

  private normalizeDashboard(raw: unknown): HoursAllocationDashboardDto {
    const row = this.asRecord(raw);
    const summary = this.asRecord(this.pick(row, ['summary', 'Summary']));

    return {
      summary: {
        totalHours: this.num(summary, ['totalHours', 'TotalHours']),
        activeUsers: this.num(summary, ['activeUsers', 'ActiveUsers']),
        projects: this.num(summary, ['projects', 'Projects', 'totalProjects', 'TotalProjects']),
        allocations: this.num(summary, ['allocations', 'Allocations']),
        averageUtilization: this.num(summary, ['averageUtilization', 'AverageUtilization']),
        yearToDateHours: this.num(summary, ['yearToDateHours', 'YearToDateHours', 'ytdHours', 'YtdHours']),
        averageMonthlyHours: this.num(summary, ['averageMonthlyHours', 'AverageMonthlyHours']),
        workedDays: this.num(summary, ['workedDays', 'WorkedDays']),
      },
      details: this.array(this.pick(row, ['details', 'Details', 'detailedAllocations', 'DetailedAllocations'])).map((item) =>
        this.toDetail(item),
      ),
      monthlyBreakdown: this.array(this.pick(row, ['monthlyBreakdown', 'MonthlyBreakdown'])).map((item) =>
        this.toMonthly(item),
      ),
      hoursByUser: this.array(this.pick(row, ['hoursByUser', 'HoursByUser', 'users', 'Users'])).map((item) =>
        this.toUser(item),
      ),
      hoursByProject: this.array(this.pick(row, ['hoursByProject', 'HoursByProject', 'projects', 'Projects'])).map(
        (item) => this.toProject(item),
      ),
      hoursByRole: this.array(this.pick(row, ['hoursByRole', 'HoursByRole', 'roles', 'Roles'])).map((item) =>
        this.toRole(item),
      ),
      hoursByTeam: this.array(this.pick(row, ['hoursByTeam', 'HoursByTeam', 'team', 'Team'])).map((item) =>
        this.toTeam(item),
      ),
      hoursByProjectUser: this.array(
        this.pick(row, ['hoursByProjectUser', 'HoursByProjectUser', 'projectUsers', 'ProjectUsers']),
      ).map((item) => this.toProjectUser(item)),
      pagination: this.toPagination(this.pick(row, ['pagination', 'Pagination'])),
    };
  }

  private toPagination(item: unknown) {
    if (!item) return undefined;
    const r = this.asRecord(item);
    return {
      pageNumber: this.num(r, ['pageNumber', 'PageNumber']),
      pageSize: this.num(r, ['pageSize', 'PageSize']),
      totalCount: this.num(r, ['totalCount', 'TotalCount']),
      totalPages: this.num(r, ['totalPages', 'TotalPages']),
      hasPreviousPage: Boolean(this.pick(r, ['hasPreviousPage', 'HasPreviousPage'])),
      hasNextPage: Boolean(this.pick(r, ['hasNextPage', 'HasNextPage'])),
    };
  }

  private toDetail(item: unknown): HoursAllocationDetailDto {
    const r = this.asRecord(item);
    return {
      date: this.str(r, ['date', 'Date']),
      userId: this.str(r, ['userId', 'UserId']),
      userName: this.str(r, ['userName', 'UserName', 'fullName', 'FullName']),
      projectId: this.str(r, ['projectId', 'ProjectId']),
      projectName: this.str(r, ['projectName', 'ProjectName']),
      type: this.str(r, ['type', 'Type', 'frequency', 'Frequency']),
      executionHours: this.num(r, ['executionHours', 'ExecutionHours']),
      techLeadHours: this.num(r, ['techLeadHours', 'TechLeadHours', 'technicalSupervisionHours', 'TechnicalSupervisionHours']),
      processHours: this.num(r, ['processHours', 'ProcessHours']),
      projectManagementHours: this.num(r, ['projectManagementHours', 'ProjectManagementHours', 'managementHours', 'ManagementHours']),
      researchAndDevHours: this.num(r, ['researchAndDevHours', 'ResearchAndDevHours', 'rAndDHours', 'RAndDHours']),
      workshopHours: this.num(r, ['workshopHours', 'WorkshopHours']),
      otherHours: this.num(r, ['otherHours', 'OtherHours']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
    };
  }

  private toMonthly(item: unknown): HoursAllocationMonthlyDto {
    const r = this.asRecord(item);
    return {
      year: this.num(r, ['year', 'Year']),
      month: this.num(r, ['month', 'Month']),
      monthName: this.str(r, ['monthName', 'MonthName']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
      utilizationPercentage: this.num(r, ['utilizationPercentage', 'UtilizationPercentage', 'percentage', 'Percentage']),
    };
  }

  private toUser(item: unknown): HoursAllocationByUserDto {
    const r = this.asRecord(item);
    return {
      userId: this.str(r, ['userId', 'UserId']),
      userName: this.str(r, ['userName', 'UserName', 'fullName', 'FullName']),
      role: this.str(r, ['role', 'Role', 'roleName', 'RoleName']),
      department: this.str(r, ['department', 'Department', 'departmentName', 'DepartmentName']),
      allocatedHours: this.num(r, ['allocatedHours', 'AllocatedHours', 'totalHours', 'TotalHours']),
      durationLabel: this.str(r, ['durationLabel', 'DurationLabel']),
      remainingHours: this.num(r, ['remainingHours', 'RemainingHours']),
      availableHours: this.num(r, ['availableHours', 'AvailableHours']),
      utilizationPercentage: this.num(r, ['utilizationPercentage', 'UtilizationPercentage']),
      executionHours: this.num(r, ['executionHours', 'ExecutionHours']),
      techLeadHours: this.num(r, ['techLeadHours', 'TechLeadHours', 'technicalSupervisionHours', 'TechnicalSupervisionHours']),
      processHours: this.num(r, ['processHours', 'ProcessHours']),
      projectManagementHours: this.num(r, ['projectManagementHours', 'ProjectManagementHours']),
      researchAndDevHours: this.num(r, ['researchAndDevHours', 'ResearchAndDevHours', 'rAndDHours', 'RAndDHours']),
      workshopHours: this.num(r, ['workshopHours', 'WorkshopHours']),
      projectCount: this.num(r, ['projectCount', 'ProjectCount', 'projects', 'Projects']),
      allocationCount: this.num(r, ['allocationCount', 'AllocationCount', 'allocations', 'Allocations']),
    };
  }

  private toProject(item: unknown): HoursAllocationByProjectDto {
    const r = this.asRecord(item);
    return {
      projectId: this.str(r, ['projectId', 'ProjectId']),
      projectName: this.str(r, ['projectName', 'ProjectName']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
      projectManagerHours: this.num(r, ['projectManagerHours', 'ProjectManagerHours', 'pmHours', 'PMHours']),
      teamHours: this.num(r, ['teamHours', 'TeamHours']),
      teamMembers: this.num(r, ['teamMembers', 'TeamMembers']),
      allocations: this.num(r, ['allocations', 'Allocations']),
    };
  }

  private toRole(item: unknown): HoursAllocationByRoleDto {
    const r = this.asRecord(item);
    return {
      roleId: this.str(r, ['roleId', 'RoleId']),
      role: this.str(r, ['role', 'Role', 'roleName', 'RoleName']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
      teamMembers: this.num(r, ['teamMembers', 'TeamMembers']),
      percentage: this.num(r, ['percentage', 'Percentage']),
    };
  }

  private toTeam(item: unknown): HoursAllocationByTeamDto {
    const r = this.asRecord(item);
    return {
      memberId: this.str(r, ['memberId', 'MemberId', 'userId', 'UserId']),
      memberName: this.str(r, ['memberName', 'MemberName', 'userName', 'UserName']),
      projectName: this.str(r, ['projectName', 'ProjectName']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
      workedDays: this.num(r, ['workedDays', 'WorkedDays']),
      allocationCount: this.num(r, ['allocationCount', 'AllocationCount', 'allocations', 'Allocations']),
    };
  }

  private toProjectUser(item: unknown): HoursAllocationByProjectUserDto {
    const r = this.asRecord(item);
    return {
      projectId: this.str(r, ['projectId', 'ProjectId']),
      projectName: this.str(r, ['projectName', 'ProjectName']),
      userId: this.str(r, ['userId', 'UserId']),
      userName: this.str(r, ['userName', 'UserName', 'fullName', 'FullName']),
      role: this.str(r, ['role', 'Role', 'roleName', 'RoleName']),
      totalHours: this.num(r, ['totalHours', 'TotalHours']),
      executionHours: this.num(r, ['executionHours', 'ExecutionHours']),
      techLeadHours: this.num(r, ['techLeadHours', 'TechLeadHours', 'technicalSupervisionHours', 'TechnicalSupervisionHours']),
      processHours: this.num(r, ['processHours', 'ProcessHours']),
      projectManagementHours: this.num(r, ['projectManagementHours', 'ProjectManagementHours', 'managementHours', 'ManagementHours']),
      researchAndDevHours: this.num(r, ['researchAndDevHours', 'ResearchAndDevHours', 'rAndDHours', 'RAndDHours']),
      workshopHours: this.num(r, ['workshopHours', 'WorkshopHours']),
      otherHours: this.num(r, ['otherHours', 'OtherHours']),
      workedDays: this.num(r, ['workedDays', 'WorkedDays']),
      allocationCount: this.num(r, ['allocationCount', 'AllocationCount', 'allocations', 'Allocations']),
      isProjectManager: Boolean(this.pick(r, ['isProjectManager', 'IsProjectManager'])),
    };
  }

  private normalizeFilters(raw: unknown): HoursAllocationFiltersDto {
    const row = this.asRecord(raw);
    return {
      users: this.optionArray(this.pick(row, ['users', 'Users'])),
      projects: this.optionArray(this.pick(row, ['projects', 'Projects'])),
      roles: this.optionArray(this.pick(row, ['roles', 'Roles'])),
      members: this.optionArray(this.pick(row, ['members', 'Members', 'teamMembers', 'TeamMembers'])),
      fiscalYears: this.array(this.pick(row, ['fiscalYears', 'FiscalYears'])).map(Number).filter(Number.isFinite),
      months: this.array(this.pick(row, ['months', 'Months'])).map((item) => {
        const r = this.asRecord(item);
        return {
          value: this.num(r, ['value', 'Value', 'month', 'Month']),
          label: this.str(r, ['label', 'Label', 'name', 'Name', 'monthName', 'MonthName']),
        };
      }),
    };
  }

  private optionArray(source: unknown): Array<{ id: string; label: string }> {
    return this.array(source)
      .map((item) => {
        const r = this.asRecord(item);
        return {
          id: this.str(r, ['id', 'Id', 'value', 'Value', 'userId', 'UserId', 'projectId', 'ProjectId', 'roleId', 'RoleId']),
          label: this.str(r, ['label', 'Label', 'name', 'Name', 'fullName', 'FullName', 'projectName', 'ProjectName', 'role', 'Role']),
        };
      })
      .filter((item) => item.id || item.label);
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
  }

  private isLooseApiResponse(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      ['Success', 'isSuccess', 'IsSuccess', 'Data', 'Result'].some((key) => key in value)
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private pick(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
    }
    return undefined;
  }

  private str(record: Record<string, unknown>, keys: string[]): string {
    const value = this.pick(record, keys);
    return value === undefined || value === null ? '' : String(value);
  }

  private num(record: Record<string, unknown>, keys: string[]): number {
    const parsed = Number(this.pick(record, keys) ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
