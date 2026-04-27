import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Role } from '../../../core/models';
import { AuthService } from '../../../core/services/auth';
import { ProjectDto, ProjectManagementType, ProjectType, ProjectReferenceData, SelectOption } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProjectReferenceService {
  private readonly apiUrl = environment.apiUrl;
  private referencesCache$?: Observable<ProjectReferenceData>;
  private parentProjectsCache$?: Observable<SelectOption[]>;
  private projectManagersCache$?: Observable<SelectOption[]>;
  private static readonly PROJECT_MANAGER_ROLE_NAMES = ['project manager', 'pm'];

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  loadAll(): Observable<ProjectReferenceData> {
    if (!this.referencesCache$) {
      this.referencesCache$ = forkJoin({
        departments: this.fetchOptions('/departments'),
        plants: this.fetchOptions('/plants'),
        businessUnits: this.fetchOptions('/businessunits'),
        technologies: this.fetchOptions('/technologies'),
        solutionDomains: this.fetchOptions('/solutiondomains'),
        users: this.fetchUsers(),
        roles: this.fetchRoles(),
      }).pipe(
        map((references) => ({
          ...references,
          parentProjects: [],
        })),
        shareReplay(1)
      );
    }

    return this.referencesCache$;
  }

  loadParentProjects(): Observable<SelectOption[]> {
    if (!this.parentProjectsCache$) {
      this.parentProjectsCache$ = this.fetchParentProjects().pipe(shareReplay(1));
    }

    return this.parentProjectsCache$;
  }

  loadProjectManagers(): Observable<SelectOption[]> {
    if (!this.projectManagersCache$) {
      this.projectManagersCache$ = this.http
        .get<ApiResponse<Role[]> | Role[]>(`${this.apiUrl}/roles`, {
          headers: this.buildHeaders(),
        })
        .pipe(
          map((response) => this.unwrapList(response)),
          map((items) =>
            items
              .map((item) => this.asRecord(item))
              .find((record) => {
                const roleName = this.readString(record, ['name']).toLowerCase();
                return ProjectReferenceService.PROJECT_MANAGER_ROLE_NAMES.includes(roleName);
              })
          ),
          switchMap((roleRecord) => {
            const roleId = roleRecord ? this.readString(roleRecord, ['id']) : '';
            if (!roleId) {
              return of([] as SelectOption[]);
            }

            return this.http
              .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/users/role/${roleId}`, {
                headers: this.buildHeaders(),
              })
              .pipe(
                map((response) => this.unwrapList(response)),
                map((items) =>
                  items
                    .map((item) => {
                      const record = this.asRecord(item);
                      const id = this.readString(record, ['userId', 'id']);
                      const firstName = this.readString(record, ['firstName']);
                      const lastName = this.readString(record, ['lastName']);
                      const fullName =
                        this.readString(record, ['fullName', 'name']) ||
                        `${firstName} ${lastName}`.trim();

                      return {
                        id,
                        label: fullName || this.readString(record, ['email']) || 'Unnamed user',
                        email: this.readString(record, ['email']),
                      };
                    })
                    .filter((user) => !!user.id)
                )
              );
          }),
          shareReplay(1)
        );
    }

    return this.projectManagersCache$;
  }

  private fetchOptions(path: string): Observable<SelectOption[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}${path}`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapList(response)),
        map((items) => items.map((item) => this.toSelectOption(item)).filter((option) => !!option.id && !!option.label))
      );
  }

  private fetchUsers(): Observable<SelectOption[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/users`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapList(response)),
        map((items) =>
          items
            .map((item) => {
              const record = this.asRecord(item);
              const id = this.readString(record, ['userId', 'id']);
              const firstName = this.readString(record, ['firstName']);
              const lastName = this.readString(record, ['lastName']);
              const fullName =
                this.readString(record, ['fullName', 'name']) ||
                `${firstName} ${lastName}`.trim();

              return {
                id,
                label: fullName || this.readString(record, ['email']) || 'Unnamed user',
                email: this.readString(record, ['email']),
              };
            })
            .filter((user) => !!user.id)
        )
      );
  }

  private fetchRoles(): Observable<SelectOption[]> {
    return this.http
      .get<ApiResponse<Role[]> | Role[]>(`${this.apiUrl}/roles`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapList(response)),
        map((items) =>
          items
            .map((item) => {
              const record = this.asRecord(item);
              return {
                id: this.readString(record, ['id']),
                label: this.readString(record, ['name']),
                description: this.readString(record, ['description']),
              };
            })
            .filter((role) => !!role.id && !!role.label)
        )
      );
  }

  private fetchParentProjects(): Observable<SelectOption[]> {
    return this.http
      .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/projects`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.normalizeProjectsResponse(response)),
        map((items) =>
          items
            .map((item) => {
              const record = this.asRecord(item);
              return {
                id: this.readString(record, ['id']),
                label: this.readString(record, ['name']),
                description: this.readString(record, ['departmentName']),
              };
            })
            .filter((project) => !!project.id && !!project.label)
        )
      );
  }

  private normalizeProjectsResponse(response: ApiResponse<unknown> | unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!this.isApiResponse(response)) {
      const raw = this.asRecord(response);
      if (Array.isArray(raw['items'])) return raw['items'] as unknown[];
      if (Array.isArray(raw['data'])) return raw['data'] as unknown[];
      return [];
    }

    if (!response.success) {
      return [];
    }

    const data = response.data as unknown;
    if (Array.isArray(data)) {
      return data;
    }

    const rawData = this.asRecord(data);
    if (Array.isArray(rawData['items'])) return rawData['items'] as unknown[];
    if (Array.isArray(rawData['projects'])) return rawData['projects'] as unknown[];
    if (Array.isArray(rawData['result'])) return rawData['result'] as unknown[];
    return [];
  }

  filterParentProjectOptions(
    projects: SelectOption[],
    projectType: ProjectType,
    currentProjectId?: string | null
  ): SelectOption[] {
    const needsParent =
      projectType === ProjectType.NewPhase ||
      projectType === ProjectType.Extension ||
      projectType === ProjectType.Sustain;

    if (!needsParent) {
      return [];
    }

    return projects.filter((project) => project.id !== currentProjectId);
  }

  private buildHeaders(): HttpHeaders {
    const token = this.authService.getToken();

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
        })
      : new HttpHeaders();
  }

  private unwrapList(response: ApiResponse<unknown[]> | unknown[]): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as Record<string, unknown>);
  }

  private toSelectOption(item: unknown): SelectOption {
    const record = this.asRecord(item);
    return {
      id: this.readString(record, ['id', 'departmentId', 'businessUnitId', 'technologyId', 'solutionDomainId']),
      label: this.readString(record, ['name', 'label', 'title']),
      description: this.readString(record, ['description']),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }
}
