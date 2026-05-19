import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models';
import { AuthService } from '../../../core/services/auth';
import {
  CreateInternHourEntryDto,
  CreateProjectInternAllocationDto,
  InternHourEntryDto,
  ProjectInternAllocationDto,
  UpdateInternHourEntryDto,
  UpdateProjectInternAllocationDto,
} from '../../interns/models/intern.models';
import {
  CreateProjectDto,
  DashboardAdminBiDto,
  DashboardExtendedDto,
  DashboardFilterParams,
  DashboardOverviewDto,
  DashboardPerformanceDto,
  DashboardPerformanceProjectDto,
  DashboardStatsDto,
  PaginatedResponse,
  ProjectDto,
  ProjectFilterParams,
  ProjectSummaryDto,
  UpdateProjectPayload,
  UploadProjectFile,
  DashboardGroupedDistributionDto,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  getProject(id: string): Observable<ProjectDto> {
    return this.http
      .get<ApiResponse<ProjectDto>>(`${this.apiUrl}/${id}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load project')));
  }

  getProjects(): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(this.apiUrl, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapResponse(response, 'Unable to load projects')),
        catchError(() =>
          this.http
            .get<ApiResponse<unknown> | unknown>(`${this.apiUrl}/paged`, {
              headers: this.buildHeaders(),
              params: {
                pageNumber: 1,
                pageSize: 50,
              },
            })
            .pipe(map((response) => this.normalizeProjectsList(response)))
        )
      );
  }

  getUserDashboardStats(): Observable<DashboardStatsDto> {
    return this.getUserDashboardStatsFiltered({});
  }

  getUserDashboardStatsFiltered(filters: DashboardFilterParams): Observable<DashboardStatsDto> {
    return this.http
      .get<ApiResponse<DashboardStatsDto> | DashboardStatsDto>(`${environment.apiUrl}/dashboard/me`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => this.normalizeDashboardStats(response)));
  }

  getUserDashboardOverview(filters: DashboardFilterParams): Observable<DashboardOverviewDto> {
    return this.http
      .get<ApiResponse<DashboardOverviewDto> | DashboardOverviewDto>(`${environment.apiUrl}/dashboard/me`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => this.normalizeDashboardOverview(response)));
  }

  getUserDashboardPerformance(filters: DashboardFilterParams): Observable<DashboardPerformanceDto> {
    return this.http
      .get<ApiResponse<DashboardPerformanceDto> | DashboardPerformanceDto>(
        `${environment.apiUrl}/dashboard/me/performance`,
        {
          headers: this.buildHeaders(),
          params: this.buildDashboardParams(filters),
        }
      )
      .pipe(map((response) => this.normalizeDashboardPerformance(response)));
  }

  getAdminDashboardStats(): Observable<DashboardStatsDto> {
    return this.getAdminDashboardStatsFiltered({});
  }

  getAdminDashboardStatsFiltered(filters: DashboardFilterParams): Observable<DashboardStatsDto> {
    return this.http
      .get<ApiResponse<DashboardStatsDto> | DashboardStatsDto>(`${environment.apiUrl}/dashboard/admin`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => this.normalizeDashboardStats(response)));
  }

  getAdminDashboardOverview(filters: DashboardFilterParams): Observable<DashboardOverviewDto> {
    return this.http
      .get<ApiResponse<DashboardOverviewDto> | DashboardOverviewDto>(`${environment.apiUrl}/dashboard/admin`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => this.normalizeDashboardOverview(response)));
  }

  getAdminDashboardBi(filters: DashboardFilterParams): Observable<DashboardAdminBiDto> {
    return this.http
      .get<ApiResponse<DashboardAdminBiDto> | DashboardAdminBiDto>(`${environment.apiUrl}/dashboard/admin/bi`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => this.normalizeDashboardBi(response)));
  }

  getAdminDashboardExtended(filters: DashboardFilterParams): Observable<DashboardExtendedDto> {
    return this.http
      .get<ApiResponse<DashboardExtendedDto>>(`${environment.apiUrl}/dashboard/admin/extended`, {
        headers: this.buildHeaders(),
        params: this.buildDashboardParams(filters),
      })
      .pipe(map((response) => response.data!));
  }

  getAdminDashboardGroupedDistribution(filters: DashboardFilterParams): Observable<DashboardGroupedDistributionDto> {
    let httpParams = new HttpParams();
    
    const keyMap: Record<string, string> = {
      projectStatus: 'ProjectStatus',
      projectPhase: 'ProjectPhase',
      processStatus: 'ProcessStatus',
      departmentId: 'DepartmentId',
      businessUnitId: 'BusinessUnitId',
      plantId: 'PlantId',
      projectManagerId: 'ProjectManagerId',
      projectType: 'ProjectType',
      projectManagementType: 'ProjectManagementType',
      year: 'Year',
      month: 'Month',
      startDate: 'StartDate',
      endDate: 'EndDate',
      ytd: 'Ytd',
      roleId: 'RoleId'
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      const apiKey = keyMap[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
      httpParams = httpParams.set(apiKey, String(value));
    });

    return this.http
      .get<ApiResponse<DashboardGroupedDistributionDto>>(`${environment.apiUrl}/dashboard/admin/grouped-distribution/counts`, {
        headers: this.buildHeaders(),
        params: httpParams,
      })
      .pipe(map((response) => response.data!));
  }

  getAdminUserPerformance(userId: string, filters: DashboardFilterParams): Observable<DashboardPerformanceDto> {
    return this.http
      .get<ApiResponse<DashboardPerformanceDto> | DashboardPerformanceDto>(
        `${environment.apiUrl}/dashboard/admin/user/${userId}/performance`,
        {
          headers: this.buildHeaders(),
          params: this.buildDashboardParams(filters),
        }
      )
      .pipe(map((response) => this.normalizeDashboardPerformance(response)));
  }

  createProject(payload: any): Observable<ProjectDto> {
    const mappedPayload = this.mapToBackendDto(payload);
    return this.http
      .post<ApiResponse<ProjectDto>>(this.apiUrl, mappedPayload, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapResponse(response, 'Unable to create project')),
        catchError((error) =>
          throwError(() => new Error(this.extractErrorMessage(error, 'Unable to create project')))
        )
      );
  }

  updateProject(id: string, payload: any): Observable<ProjectDto> {
    const mappedPayload = this.mapToBackendDto(payload);
    return this.http
      .put<ApiResponse<ProjectDto>>(`${this.apiUrl}/${id}`, mappedPayload, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => this.unwrapResponse(response, 'Unable to update project')),
        catchError((error) =>
          throwError(() => new Error(this.extractErrorMessage(error, 'Unable to update project')))
        )
      );
  }

  private mapToBackendDto(form: any): any {
    // Si c'est déjà au format backend, on ne touche à rien
    if (Array.isArray(form.strategicCriteria)) {
      const backendForm = { ...form };
      delete backendForm.members;
      return {
        ...backendForm,
        teamMembers: this.filterProjectManagerFromMembers(form.teamMembers ?? form.members, form.projectManagerId),
      };
    }

    // 1. Map Strategic Criteria (Object -> Array)
    const strategicCriteria: any[] = [];
    if (form.strategicCriteria) {
      const criteriaMap: Record<string, number> = {
        financialImpact: 1,
        customerImpact: 2,
        operationalEfficiency: 3,
        strategicAlignment: 4,
        crossFunctionalImpact: 5,
        innovationDigitalisation: 6,
        riskMitigationUrgency: 7,
        sustainabilityESG: 8
      };

      Object.entries(form.strategicCriteria).forEach(([key, value]) => {
        if (criteriaMap[key] !== undefined && value !== null) {
          strategicCriteria.push({
            type: criteriaMap[key],
            score: Number(value) || 0,
            comment: ''
          });
        }
      });
    }

    // 2. Map KPIs (Object -> Array)
    const kpIs: any[] = [];
    if (form.kpi) {
      Object.entries(form.kpi).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          kpIs.push({
            name: key,
            targetValue: Number(value) || 0,
            currentValue: 0,
            description: `KPI for ${key}`
          });
        }
      });
    }

    // 3. Map Project Resources (budgetItems -> projectResources)
    const projectResources = (form.budgetItems || []).map((item: any) => ({
      itemName: item.itemName,
      pricePerUnit: Number(item.pricePerUnit) || 0,
      quantity: Number(item.quantity) || 0,
      costCenter: item.costCenter || ''
    }));

    // 4. Map Team Members. The project manager is a separate resource.
    const teamMembers = this.filterProjectManagerFromMembers(form.teamMembers, form.projectManagerId).map((m: any) => ({
      userId: typeof m === 'string' ? m : (m.userId || m.id || m),
      roleId: typeof m === 'string' ? '' : (m.roleId || m.RoleId || '')
    }));

    // 5. Construct final DTO for Backend
    return {
      name: form.name,
      description: form.description || '',
      departmentId: form.departmentId,
      projectManagerId: form.projectManagerId,
      startDate: form.startDate || null,
      endDate: form.endDate,
      estimatedDueDate: form.estimatedDueDate || form.endDate,
      phase: Number(form.phase) || 0,
      status: Number(form.status) || 0,
      processStatus: Number(form.processStatus) || 0,
      sponsor: form.sponsor || '',
      costSaving: Number(form.costSaving) || 0,
      projectManagementType: Number(form.projectManagementType) || 0,
      projectType: Number(form.projectType) || 0,
      currentState: form.currentState || '',
      nextSteps: form.nextSteps || '',
      enhancements: form.enhancements || '',
      estimatedHours: Number(form.estimatedHours) || 0,
      actualHours: Number(form.actualHours) || 0,
      parentProjectId: form.parentProjectId === '00000000-0000-0000-0000-000000000000' ? null : form.parentProjectId,
      businessUnitIds: form.businessUnitIds || [],
      technologyIds: form.technologyIds || [],
      solutionDomainIds: form.solutionDomainIds || [],
      teamMembers: teamMembers,
      projectResources: projectResources,
      strategicCriteria: strategicCriteria,
      kpIs: kpIs,
      // Default values to satisfy backend DTO
      budget: Number(form.budget) || 0,
      digitalContribution: Number(form.digitalContribution) || 0,
      progressPercentage: Number(form.progressPercentage) || 0,
      costCenter: form.costCenter || '',
      codeSourceLink: form.codeSourceLink || '',
      solutionLink: form.solutionLink || '',
      serverHostName: form.serverHostName || '',
      roadblocks: Array.isArray(form.roadblocks) ? form.roadblocks.join(', ') : (form.roadblocks || '')
    };
  }

  private filterProjectManagerFromMembers(members: any[] | null | undefined, projectManagerId: string | null | undefined): any[] {
    return (members || []).filter((member: any) => {
      const userId = typeof member === 'string' ? member : (member?.userId || member?.UserId || member?.id || member?.Id);
      return !projectManagerId || userId !== projectManagerId;
    });
  }

  uploadProjectFile(projectId: string, fileData: UploadProjectFile): Observable<any> {
    const formData = new FormData();
    formData.append('File', fileData.file);
    formData.append('FileType', fileData.fileType.toString());
    if (fileData.description) {
      formData.append('Description', fileData.description);
    }

    return this.http.post(`${this.apiUrl}/${projectId}/files`, formData, {
      headers: this.buildHeaders().delete('Content-Type'), // Let browser set boundary
    });
  }

  deleteProject(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${id}`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return;
          }

          throw new Error(response.message || 'Unable to delete project');
        })
      );
  }

  getProjectsPaged(
    params: ProjectFilterParams = {},
    options?: { noCache?: boolean }
  ): Observable<PaginatedResponse<ProjectSummaryDto>> {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const apiKey = this.toProjectSearchParamName(key);
        const apiValue = apiKey === 'pageSize' ? Math.min(Number(value) || 10, 100) : value;
        httpParams = httpParams.set(apiKey, String(apiValue));
      }
    });

    let headers = this.buildHeaders();
    if (options?.noCache) {
      headers = headers
        .set('Cache-Control', 'no-cache, no-store, must-revalidate')
        .set('Pragma', 'no-cache');
    }

    return this.http
      .get<ApiResponse<PaginatedResponse<ProjectSummaryDto>> | PaginatedResponse<ProjectSummaryDto>>(`${this.apiUrl}/paged`, {
        headers,
        params: httpParams,
      })
      .pipe(
        map((response) => {
          const data = this.isApiResponse(response) ? response.data : response;
          return (data ?? { data: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }) as PaginatedResponse<ProjectSummaryDto>;
        })
      );
  }

  patchProject(id: string, payload: Record<string, unknown>): Observable<ProjectDto> {
    return this.http
      .patch<ApiResponse<ProjectDto>>(`${this.apiUrl}/${id}`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to update project')));
  }

  getProjectsByDepartment(departmentId: string): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(`${this.apiUrl}/department/${departmentId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load projects')));
  }

  getProjectsByBusinessUnit(businessUnitId: string): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(`${this.apiUrl}/businessunit/${businessUnitId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load projects')));
  }

  getProjectsByPlant(plantId: string): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(`${this.apiUrl}/plant/${plantId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load projects')));
  }

  getProjectsByStatus(status: string): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(`${this.apiUrl}/status/${status}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load projects')));
  }

  getProjectsByPhase(phase: string): Observable<ProjectSummaryDto[]> {
    return this.http
      .get<ApiResponse<ProjectSummaryDto[]>>(`${this.apiUrl}/phase/${phase}`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => this.unwrapResponse(response, 'Unable to load projects')));
  }

  exportProjects(filters: Record<string, string | number | boolean | null | undefined>): Observable<Blob> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'all') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get(`${this.apiUrl}/export`, {
      headers: this.buildHeaders(),
      params,
      responseType: 'blob',
    });
  }

  addSubProject(projectId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/subprojects`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  addMember(projectId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/members`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  removeMember(projectId: string, userId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/members/${userId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to remove member');
        })
      );
  }

  getDeliverables(projectId: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/deliverables`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  createDeliverable(projectId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/deliverables`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  updateDeliverable(projectId: string, deliverableId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/deliverables/${deliverableId}`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  deleteDeliverable(projectId: string, deliverableId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/deliverables/${deliverableId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete deliverable');
        })
      );
  }

  createDeliverableTask(projectId: string, deliverableId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/deliverables/${deliverableId}/tasks`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  updateDeliverableTask(projectId: string, deliverableId: string, taskId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(
        `${this.apiUrl}/${projectId}/deliverables/${deliverableId}/tasks/${taskId}`,
        payload,
        { headers: this.buildHeaders() }
      )
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  deleteDeliverableTask(projectId: string, deliverableId: string, taskId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/deliverables/${deliverableId}/tasks/${taskId}`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete task');
        })
      );
  }

  getTimeline(projectId: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/timeline`, { headers: this.buildHeaders() })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  createTimelineEntry(projectId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/timeline`, payload, { headers: this.buildHeaders() })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  updateTimelineEntry(projectId: string, entryId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/timeline/${entryId}`, payload, { headers: this.buildHeaders() })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  deleteTimelineEntry(projectId: string, entryId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/timeline/${entryId}`, { headers: this.buildHeaders() })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete timeline entry');
        })
      );
  }

  getRoadblocks(projectId: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/roadblocks`, { headers: this.buildHeaders() })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  getDelayedRoadblocks(projectId: string): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]> | unknown[]>(`${this.apiUrl}/${projectId}/roadblocks/delayed`, { headers: this.buildHeaders() })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  createRoadblock(projectId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/roadblocks`, payload, { headers: this.buildHeaders() })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  updateRoadblock(projectId: string, roadblockId: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http
      .put<ApiResponse<unknown> | unknown>(`${this.apiUrl}/${projectId}/roadblocks/${roadblockId}`, payload, { headers: this.buildHeaders() })
      .pipe(map((response) => (this.isApiResponse(response) ? response.data : response)));
  }

  deleteRoadblock(projectId: string, roadblockId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/roadblocks/${roadblockId}`, { headers: this.buildHeaders() })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete roadblock');
        })
      );
  }

  getInternAllocations(projectId: string): Observable<ProjectInternAllocationDto[]> {
    return this.http
      .get<ApiResponse<ProjectInternAllocationDto[]> | ProjectInternAllocationDto[]>(`${this.apiUrl}/${projectId}/interns`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  createInternAllocation(projectId: string, payload: CreateProjectInternAllocationDto): Observable<ProjectInternAllocationDto | null> {
    return this.http
      .post<ApiResponse<ProjectInternAllocationDto> | ProjectInternAllocationDto>(`${this.apiUrl}/${projectId}/interns`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? (response.data ?? null) : response)));
  }

  updateInternAllocation(
    projectId: string,
    allocationId: string,
    payload: UpdateProjectInternAllocationDto
  ): Observable<ProjectInternAllocationDto | null> {
    return this.http
      .put<ApiResponse<ProjectInternAllocationDto> | ProjectInternAllocationDto>(
        `${this.apiUrl}/${projectId}/interns/${allocationId}`,
        payload,
        { headers: this.buildHeaders() }
      )
      .pipe(map((response) => (this.isApiResponse(response) ? (response.data ?? null) : response)));
  }

  deleteInternAllocation(projectId: string, allocationId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/interns/${allocationId}`, { headers: this.buildHeaders() })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete allocation');
        })
      );
  }

  getInternHours(projectId: string, allocationId: string): Observable<InternHourEntryDto[]> {
    return this.http
      .get<ApiResponse<InternHourEntryDto[]> | InternHourEntryDto[]>(`${this.apiUrl}/${projectId}/interns/${allocationId}/hours`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data || [])));
  }

  createInternHour(
    projectId: string,
    allocationId: string,
    payload: CreateInternHourEntryDto
  ): Observable<InternHourEntryDto | null> {
    return this.http
      .post<ApiResponse<InternHourEntryDto> | InternHourEntryDto>(`${this.apiUrl}/${projectId}/interns/${allocationId}/hours`, payload, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => (this.isApiResponse(response) ? (response.data ?? null) : response)));
  }

  updateInternHour(
    projectId: string,
    allocationId: string,
    hourEntryId: string,
    payload: UpdateInternHourEntryDto
  ): Observable<InternHourEntryDto | null> {
    return this.http
      .put<ApiResponse<InternHourEntryDto> | InternHourEntryDto>(
        `${this.apiUrl}/${projectId}/interns/${allocationId}/hours/${hourEntryId}`,
        payload,
        { headers: this.buildHeaders() }
      )
      .pipe(map((response) => (this.isApiResponse(response) ? (response.data ?? null) : response)));
  }

  deleteInternHour(projectId: string, allocationId: string, hourEntryId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${projectId}/interns/${allocationId}/hours/${hourEntryId}`, { headers: this.buildHeaders() })
      .pipe(
        map((response) => {
          if (response.success) return;
          throw new Error(response.message || 'Unable to delete hour entry');
        })
      );
  }

  exportMonthly(year: number, month: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/monthly/${year}/${month}`, {
      headers: this.buildHeaders(),
      responseType: 'blob',
    });
  }

  exportYearly(companyYear: string | number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/yearly/${companyYear}`, {
      headers: this.buildHeaders(),
      responseType: 'blob',
    });
  }

  private buildHeaders(): HttpHeaders {
    const token = this.authService.getToken();

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
        })
      : new HttpHeaders();
  }

  private unwrapResponse<T>(response: ApiResponse<T>, fallbackMessage: string): T {
    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.message || fallbackMessage);
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return error.message || fallbackMessage;
    }

    if (error instanceof HttpErrorResponse) {
      const backendError = error.error;

      if (typeof backendError === 'string' && backendError.trim()) {
        return backendError.trim();
      }

      if (backendError && typeof backendError === 'object') {
        const raw = backendError as Record<string, unknown>;
        const directMessage = this.firstString(raw, ['message', 'Message', 'error', 'Error', 'detail', 'title']);
        if (directMessage) {
          return directMessage;
        }

        const validationErrors = raw['errors'];
        if (validationErrors && typeof validationErrors === 'object') {
          const messages = Object.values(validationErrors as Record<string, unknown>)
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .filter((value): value is string => typeof value === 'string' && !!value.trim());

          if (messages.length) {
            return messages.join(' ');
          }
        }
      }

      return error.message || fallbackMessage;
    }

    return fallbackMessage;
  }

  private firstString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private isApiResponse(value: unknown): value is ApiResponse<any> {
    return typeof value === 'object' && value !== null && 'success' in (value as any);
  }

  private normalizeProjectsList(response: ApiResponse<unknown> | unknown): ProjectSummaryDto[] {
    if (Array.isArray(response)) {
      return response as ProjectSummaryDto[];
    }

    if (!this.isApiResponse(response)) {
      const raw = response as Record<string, unknown>;
      if (Array.isArray(raw?.['items'])) {
        return raw['items'] as ProjectSummaryDto[];
      }
      if (Array.isArray(raw?.['data'])) {
        return raw['data'] as ProjectSummaryDto[];
      }
      return [];
    }

    if (!response.success) {
      throw new Error(response.message || 'Unable to load projects');
    }

    const data = response.data as unknown;
    if (Array.isArray(data)) {
      return data as ProjectSummaryDto[];
    }

    const rawData = data as Record<string, unknown> | null;
    if (rawData && Array.isArray(rawData['items'])) {
      return rawData['items'] as ProjectSummaryDto[];
    }

    if (rawData && Array.isArray(rawData['projects'])) {
      return rawData['projects'] as ProjectSummaryDto[];
    }

    if (rawData && Array.isArray(rawData['result'])) {
      return rawData['result'] as ProjectSummaryDto[];
    }

    return [];
  }

  private buildDashboardParams(filters: DashboardFilterParams): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }

  private toProjectSearchParamName(key: string): string {
    const map: Record<string, string> = {
      PageNumber: 'pageNumber',
      PageSize: 'pageSize',
      Search: 'search',
      SortBy: 'sortBy',
      SortDescending: 'sortDescending',
      Status: 'status',
      Phase: 'phase',
      ProjectType: 'projectType',
      ProjectManagementType: 'projectManagementType',
      DepartmentId: 'departmentId',
      BusinessUnitId: 'businessUnitId',
      PlantId: 'plantId',
      IncompleteOnly: 'incompleteOnly',
      incompleteOnly: 'incompleteOnly',
      all: 'all',
      All: 'all',
    };

    return map[key] ?? key;
  }

  private normalizeDashboardStats(response: ApiResponse<DashboardStatsDto> | DashboardStatsDto): DashboardStatsDto {
    const payload = this.isApiResponse(response) ? response.data : response;
    const raw = (payload ?? {}) as Record<string, unknown>;
    const summary = (raw['summary'] ?? {}) as Record<string, unknown>;
    const charts = (raw['charts'] ?? {}) as Record<string, unknown>;

    const totalProjects = Number(summary['totalProjects'] ?? raw['totalProjects'] ?? 0);
    const averageEffectiveness = Number(summary['averageEffectiveness'] ?? raw['averageEffectiveness'] ?? 0);
    const averageOtd = Number(summary['averageOtd'] ?? raw['averageOtd'] ?? 0);
    const delayedProjects = Number(summary['delayedProjects'] ?? raw['delayedProjects'] ?? 0);
    const projectsByPhaseSource = charts['projectsByPhase'] ?? raw['projectsByPhase'];
    const projectsByPhase = this.normalizeChartMap(projectsByPhaseSource);

    const normalized = {
      totalProjects: Number.isFinite(totalProjects) ? totalProjects : 0,
      averageEffectiveness: Number.isFinite(averageEffectiveness) ? averageEffectiveness : 0,
      averageOtd: Number.isFinite(averageOtd) ? averageOtd : 0,
      delayedProjects: Number.isFinite(delayedProjects) ? delayedProjects : 0,
      projectsByPhase,
       totalEstimatedHours: Number(summary['totalEstimatedHours'] ?? 0),
      totalTrackedHours: Number(summary['totalTrackedHours'] ?? 0),
      ytdHours: Number(summary['ytdHours'] ?? 0),
      totalUsers: Number(summary['totalUsers'] ?? 0),
      activeUsers: Number(summary['activeUsers'] ?? 0),
      approvedUsers: Number(summary['approvedUsers'] ?? 0),
      projectsByStatus: charts['projectsByStatus'] ?? [],
      topProjectsByHours: charts['topProjectsByHours'] ?? [],
      usersByRole: charts['usersByRole'] ?? [],
      deliveryMetrics: charts['deliveryMetrics'] ?? [],
    } as DashboardStatsDto;

    return normalized;
  }

  private normalizeDashboardOverview(
    response: ApiResponse<DashboardOverviewDto> | DashboardOverviewDto
  ): DashboardOverviewDto {
    const payload = this.isApiResponse(response) ? response.data : response;
    const raw = (payload ?? {}) as Record<string, unknown>;
    const summary = (raw['summary'] ?? raw) as Record<string, unknown>;
    const charts = (raw['charts'] ?? {}) as Record<string, unknown>;

    return {
      summary: {
        totalProjects: this.toFiniteNumber(summary['totalProjects']),
        totalEstimatedHours: this.toFiniteNumber(summary['totalEstimatedHours']),
        totalTrackedHours: this.toFiniteNumber(summary['totalTrackedHours']),
        ytdHours: this.toFiniteNumber(summary['ytdHours']),
        averageOtd: this.toFiniteNumber(summary['averageOtd']),
        averageEffectiveness: this.toFiniteNumber(summary['averageEffectiveness']),
        delayedProjects: this.toFiniteNumber(summary['delayedProjects']),
        totalUsers: this.toFiniteNumber(summary['totalUsers']),
        activeUsers: this.toFiniteNumber(summary['activeUsers']),
        approvedUsers: this.toFiniteNumber(summary['approvedUsers']),
        annualGoalProgressPercentage: this.toFiniteNumber(summary['annualGoalProgressPercentage'] ?? summary['annualGoalProgress']),
      },
      charts: {
        projectsByStatus: this.normalizeLabelValues(charts['projectsByStatus']),
        projectsByPhase: this.normalizeLabelValues(charts['projectsByPhase']),
        topProjectsByHours: this.normalizeTopProjects(charts['topProjectsByHours']),
        usersByRole: this.normalizeRoleValues(charts['usersByRole']),
        projectTeamMembersByRole: this.normalizeRoleValues(charts['projectTeamMembersByRole']),
        monthlyHoursBreakdownByCategory: this.normalizeLabelValues(charts['monthlyHoursBreakdownByCategory']),
        hoursByStage: this.normalizeLabelValues(charts['hoursByStage']),
        deliveryMetrics: this.normalizeLabelValues(charts['deliveryMetrics']),
      },
    };
  }

  private normalizeDashboardBi(
    response: ApiResponse<DashboardAdminBiDto> | DashboardAdminBiDto
  ): DashboardAdminBiDto {
    const payload = this.isApiResponse(response) ? response.data : response;
    const raw = (payload ?? {}) as Record<string, unknown>;

    return {
      filters: this.toPlainRecord(raw['filters']),
      kpis: this.toPlainRecord(raw['kpis']),
      charts: this.toPlainRecord(raw['charts']),
      tables: this.toPlainRecord(raw['tables']),
      alerts: Array.isArray(raw['alerts']) ? raw['alerts'] : [],
    };
  }

  private normalizeDashboardPerformance(
    response: ApiResponse<DashboardPerformanceDto> | DashboardPerformanceDto
  ): DashboardPerformanceDto {
    const payload = this.isApiResponse(response) ? response.data : response;
    const raw = (payload ?? {}) as Record<string, unknown>;
    const summary = (raw['summary'] ?? {}) as Record<string, unknown>;
    const charts = (raw['charts'] ?? {}) as Record<string, unknown>;

    return {
      summary: {
        totalLoggedHours: this.toFiniteNumber(summary['totalLoggedHours']),
        ytdLoggedHours: this.toFiniteNumber(summary['ytdLoggedHours']),
        expectedHours: this.toFiniteNumber(summary['expectedHours']),
        utilizationRate: this.toFiniteNumber(summary['utilizationRate']),
        averageHoursPerLoggedDay: this.toFiniteNumber(summary['averageHoursPerLoggedDay']),
        loggedDays: this.toFiniteNumber(summary['loggedDays']),
        projectsWithLoggedHours: this.toFiniteNumber(summary['projectsWithLoggedHours']),
        assignedProjects: this.toFiniteNumber(summary['assignedProjects']),
        delayedAssignedProjects: this.toFiniteNumber(summary['delayedAssignedProjects']),
        premiumApprovedHours: this.toFiniteNumber(summary['premiumApprovedHours']),
        premiumPendingHours: this.toFiniteNumber(summary['premiumPendingHours']),
        totalCost: this.toFiniteNumber(summary['totalCost']),
        annualGoalProgressPercentage: this.toFiniteNumber(summary['annualGoalProgressPercentage'] ?? summary['annualGoalProgress']),
      },
      charts: {
        hoursByCategory: this.normalizeLabelValues(charts['hoursByCategory']),
        hoursByStage: this.normalizeLabelValues(charts['hoursByStage']),
        monthlyHoursByCategory: this.normalizeMonthlyPerformanceHours(charts['monthlyHoursByCategory']),
        premiumHours: this.normalizeLabelValues(charts['premiumHours']),
      },
      topProjects: this.normalizePerformanceProjects(raw['topProjects']),
    };
  }

  private normalizeMonthlyPerformanceHours(source: unknown): DashboardPerformanceDto['charts']['monthlyHoursByCategory'] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        year: this.toFiniteNumber(row['year']),
        month: this.toFiniteNumber(row['month']),
        monthName: String(row['monthName'] ?? '').trim(),
        totalHours: this.toFiniteNumber(row['totalHours']),
        executionHours: this.toFiniteNumber(row['executionHours']),
        supervisionHours: this.toFiniteNumber(row['supervisionHours']),
        processHours: this.toFiniteNumber(row['processHours']),
        managementHours: this.toFiniteNumber(row['managementHours']),
        rAndDHours: this.toFiniteNumber(row['rAndDHours']),
        workshopHours: this.toFiniteNumber(row['workshopHours']),
        otherHours: this.toFiniteNumber(row['otherHours']),
        internManagementHours: this.toFiniteNumber(row['internManagementHours']),
      };
    });
  }

  private normalizePerformanceProjects(source: unknown): DashboardPerformanceProjectDto[] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          projectId: String(row['projectId'] ?? row['id'] ?? '').trim(),
          projectName: String(row['projectName'] ?? row['name'] ?? row['label'] ?? '').trim(),
          status: String(row['status'] ?? '').trim(),
          phase: String(row['phase'] ?? '').trim(),
          totalHours: this.toFiniteNumber(row['totalHours']),
          totalCost: this.toFiniteNumber(row['totalCost']),
          projectProgressPercentage: this.toFiniteNumber(row['projectProgressPercentage']),
          estimatedDueDate: row['estimatedDueDate'] ? String(row['estimatedDueDate']) : null,
          isDelayed: Boolean(row['isDelayed']),
        };
      })
      .filter((item) => item.projectId || item.projectName);
  }

  private normalizeChartMap(source: unknown): Record<string, number> {
    if (Array.isArray(source)) {
      return source.reduce<Record<string, number>>((acc, item) => {
        const row = item as Record<string, unknown>;
        const label = String(row['label'] ?? '').trim();
        const value = Number(row['value'] ?? 0);
        if (label && Number.isFinite(value)) {
          acc[label] = value;
        }
        return acc;
      }, {});
    }
    if (source && typeof source === 'object') {
      return source as Record<string, number>;
    }
    return {};
  }

  private normalizeLabelValues(source: unknown): Array<{ label: string; value: number }> {
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            label: String(row['label'] ?? row['name'] ?? row['key'] ?? '').trim(),
            value: this.toFiniteNumber(row['value'] ?? row['count']),
          };
        })
        .filter((item) => item.label);
    }

    if (source && typeof source === 'object') {
      return Object.entries(source as Record<string, unknown>).map(([label, value]) => ({
        label,
        value: this.toFiniteNumber(value),
      }));
    }

    return [];
  }

  private normalizeTopProjects(source: unknown): Array<{ projectId: string; projectName: string; value: number }> {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((item) => {
        const row = item as Record<string, unknown>;
        const projectId = String(row['projectId'] ?? row['id'] ?? '').trim();
        const projectName = String(row['projectName'] ?? row['name'] ?? row['label'] ?? '').trim();
        return {
          projectId,
          projectName,
          value: this.toFiniteNumber(row['value'] ?? row['hours'] ?? row['totalHours']),
        };
      })
      .filter((item) => item.projectId || item.projectName);
  }

  private normalizeRoleValues(source: unknown): Array<{ roleId: string; roleName: string; value: number }> {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((item) => {
        const row = item as Record<string, unknown>;
        const roleId = String(row['roleId'] ?? row['id'] ?? '').trim();
        const roleName = String(row['roleName'] ?? row['name'] ?? row['label'] ?? '').trim();
        return {
          roleId,
          roleName,
          value: this.toFiniteNumber(row['value'] ?? row['count']),
        };
      })
      .filter((item) => item.roleId || item.roleName);
  }

  private toFiniteNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toPlainRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
