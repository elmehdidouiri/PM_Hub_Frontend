import {
  ProcessStatus,
  ProjectType,
  ProjectManagementType,
  ProjectPhase,
  ProjectStatus,
  StrategicCriterionScore,
  StrategicCriterionType,
  ProjectFileType,
} from './project.enums';

export interface SelectOption {
  id: string;
  label: string;
  description?: string;
  email?: string;
  roleId?: string;
  roleName?: string;
}

export interface ProjectMemberPayload {
  userId: string;
  roleId: string;
}

export interface ProjectResourcePayload {
  itemName: string;
  pricePerUnit: number;
  quantity: number;
  costCenter: string;
}

export interface StrategicCriterionPayload {
  type: StrategicCriterionType;
  score: StrategicCriterionScore;
  comment: string;
}

export interface ProjectKpiPayload {
  name: string;
  targetValue: number | null;
  currentValue: number | null;
  estimatedDueDate: string | null;
  actualEndDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  description: string;
}

export interface StrategicCriteriaDto {
  financialImpact: number | null;
  customerImpact: number | null;
  operationalEfficiency: number | null;
  strategicAlignment: number | null;
  crossFunctionalImpact: number | null;
  innovationDigitalisation: number | null;
  riskMitigationUrgency: number | null;
  sustainabilityESG: number | null;
}

export interface CreateProjectKpiDto {
  customerSatisfaction: number | null;
  digitalContribution: number | null;
}

export interface CreateProjectTeamMemberDto {
  userId: string;
  roleId: string;
  role?: string;
}

export interface CreateProjectBudgetItemDto {
  itemName: string;
  pricePerUnit: number;
  quantity: number;
  costCenter: string;
}

export interface CreateProjectDto {
  projectManagementType: ProjectManagementType;
  projectType: ProjectType;
  name: string;
  phase: ProjectPhase;
  status: ProjectStatus;
  description: string | null;
  projectManagerId: string | null;
  sponsor: string | null;
  businessUnitIds: string[];
  plantName: string | null;
  departmentId: string;
  costCenter: string | null;
  costSaving: number | null;
  technologyIds: string[];
  solutionDomainIds: string[];
  startDate: string;
  endDate: string | null;
  estimatedDueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  strategicCriteria: StrategicCriteriaDto;
  kpi: CreateProjectKpiDto;
  teamMembers: CreateProjectTeamMemberDto[];
  budgetItems: CreateProjectBudgetItemDto[];
  currentState: string | null;
  nextSteps: string | null;
  enhancements: string | null;
  codeSourceLink: string | null;
  solutionLink: string | null;
  roadblocks: string[];
  parentProjectId?: string | null;
  processStatus?: ProcessStatus | null;
}

export interface UploadProjectFile {
  file: File;
  fileType: ProjectFileType;
  description?: string;
  fileName?: string; // For UI display
}

export interface CreateFullProjectPayload {
  name: string;
  description: string;
  departmentId: string;
  budget: number;
  startDate: string;
  projectManagerId: string | null;
  endDate: string | null;
  estimatedDueDate: string | null;
  phase: ProjectPhase;
  status: ProjectStatus;
  processStatus: ProcessStatus;
  sponsor: string;
  digitalContribution: number | null;
  costCenter: string;
  costSaving: number | null;
  progressPercentage: number | null;
  codeSourceLink: string;
  solutionLink: string;
  serverHostName: string;
  projectManagementType: ProjectManagementType;
  currentState: string;
  roadblocks: string;
  nextSteps: string;
  enhancements: string;
  estimatedHours: number | null;
  parentProjectId: string | null;
  businessUnitIds: string[];
  technologyIds: string[];
  solutionDomainIds: string[];
  members: ProjectMemberPayload[];
  projectResources: ProjectResourcePayload[];
  strategicCriteria: StrategicCriterionPayload[];
  kpIs: ProjectKpiPayload[];
}

export type CreateProjectPayload = CreateProjectDto;

export interface UpdateProjectPayload {
  name: string;
  description: string;
  departmentId: string;
  budget: number;
  startDate: string;
  projectManagerId: string | null;
  endDate: string | null;
  estimatedDueDate: string | null;
  phase: ProjectPhase;
  status: ProjectStatus;
  processStatus: ProcessStatus;
  projectManagementType: ProjectManagementType;
  parentProjectId: string | null;
  sponsor: string;
  digitalContribution: number | null;
  costCenter: string;
  costSaving: number | null;
  progressPercentage: number | null;
  codeSourceLink: string;
  solutionLink: string;
  serverHostName: string;
  currentState: string;
  roadblocks: string;
  nextSteps: string;
  enhancements: string;
  estimatedHours: number | null;
  businessUnitIds: string[];
  technologyIds: string[];
  solutionDomainIds: string[];
  members: ProjectMemberPayload[];
  strategicCriteria: StrategicCriterionPayload[];
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  statusLabel?: string;
  phase: ProjectPhase;
  phaseLabel?: string;
  processStatus: ProcessStatus;
  processStatusLabel?: string;
  strategicScore: number;
  strategicCategory: string;
  startDate: string;
  endDate: string | null;
  estimatedDueDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  budget: number;
  digitalContribution: number;
  costSaving: number;
  estimatedHours: number;
  actualHours: number;
  progressPercentage: number;
  projectManagerId: string | null;
  projectManagerName: string | null;
  sponsor: string | null;
  costCenter: string | null;
  codeSourceLink: string | null;
  solutionLink: string | null;
  serverHostName: string | null;
  projectManagementType: ProjectManagementType;
  projectManagementTypeLabel?: string;
  projectType: ProjectType;
  projectTypeLabel?: string;
  currentState: string | null;
  roadblocks: string;
  nextSteps: string | null;
  enhancements: string | null;
  departmentId: string;
  departmentName: string;
  plantName: string;
  parentProjectId: string | null;
  parentProjectName: string | null;
  businessUnits: string[];
  technologies: string[];
  solutionDomains: string[];
  members: Array<{
    projectMemberId?: string;
    userId: string;
    fullName: string;
    email?: string;
    roleId: string;
    roleName?: string;
    joinedAt?: string;
  }>;
  kpis?: Array<{
    id?: string;
    name: string;
    targetValue: number | null;
    currentValue: number | null;
    calculatedValue?: number | null;
    estimatedDueDate: string | null;
    actualEndDate: string | null;
    estimatedHours: number | null;
    actualHours: number | null;
    description?: string | null;
    createdAt?: string;
    updatedAt?: string | null;
  }>;
  KPIs: Array<{
    id?: string;
    name: string;
    targetValue: number | null;
    currentValue: number | null;
    calculatedValue?: number | null;
    estimatedDueDate: string | null;
    actualEndDate: string | null;
    estimatedHours: number | null;
    actualHours: number | null;
    description?: string | null;
    createdAt?: string;
    updatedAt?: string | null;
  }>;
  kpIs?: Array<{
    id?: string;
    name: string;
    targetValue: number | null;
    currentValue: number | null;
    estimatedDueDate: string | null;
    actualEndDate: string | null;
    estimatedHours: number | null;
    actualHours: number | null;
    description: string;
  }>;
  internMembers: Array<Record<string, unknown>>;
  projectResources: Array<{
    id?: string;
    itemName: string;
    pricePerUnit: number | null;
    quantity: number | null;
    totalCost?: number | null;
    costCenter: string;
  }>;
  strategicCriteria: Array<{
    id?: string;
    type: StrategicCriterionType;
    score: StrategicCriterionScore;
    comment: string;
  }>;
  subProjects: Array<Record<string, unknown>>;
  deliverables: Array<Record<string, unknown>>;
  timelineEntries: Array<Record<string, unknown>>;
  roadblockEntries: Array<Record<string, unknown>>;
}

export interface ProjectFileVersionDto {
  id: string;
  projectFileId: string;
  versionNumber: number;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  description?: string;
  createdAt: string;
}

export interface ProjectFileDto {
  id: string;
  projectId: string;
  fileType: number;
  fileTypeLabel: string;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  fileSizeLabel: string;
  description?: string;
  createdAt: string;
  updatedAt?: string | null;
  versions: ProjectFileVersionDto[];
}

export interface ProjectSummaryDto {
  id: string;
  name: string;
  description: string;
  projectType: ProjectType | string;
  projectTypeLabel?: string;
  sponsor: string;
  status: ProjectStatus | string;
  statusLabel?: string;
  phase: ProjectPhase | string;
  phaseLabel?: string;
  departmentName: string;
  plantName: string;
  estimatedHours: number | null;
  actualHours: number | null;
  projectManagerName: string | null;
  projectManagerId: string | null;
  startDate: string;
  endDate?: string | null;
  estimatedDueDate: string | null;
  budget: number;
  progressPercentage: number | null;
  projectManagementType: ProjectManagementType;
  projectManagementTypeLabel?: string;
}

export interface ProjectReferenceData {
  departments: SelectOption[];
  plants: SelectOption[];
  businessUnits: SelectOption[];
  technologies: SelectOption[];
  solutionDomains: SelectOption[];
  users: SelectOption[];
  roles: SelectOption[];
  parentProjects: SelectOption[];
}

export interface DashboardStatsDto {
  totalProjects: number;
  averageEffectiveness: number;
  averageOtd: number;
  delayedProjects: number;
  projectsByPhase: { [key: string]: number };
}

export interface LabelValueDto {
  label: string;
  value: number;
}

export interface TopProjectByHoursDto {
  projectId: string;
  projectName: string;
  value: number;
}

export interface UsersByRoleDto {
  roleId: string;
  roleName: string;
  value: number;
}

export interface DashboardSummaryDto {
  totalProjects: number;
  totalEstimatedHours: number;
  totalTrackedHours: number;
  ytdHours: number;
  averageOtd: number;
  averageEffectiveness: number;
  delayedProjects: number;
  totalUsers: number;
  activeUsers: number;
  approvedUsers: number;
  annualGoalProgressPercentage: number;
}

export interface DashboardChartsDto {
  projectsByStatus: LabelValueDto[];
  projectsByPhase: LabelValueDto[];
  topProjectsByHours: TopProjectByHoursDto[];
  usersByRole: UsersByRoleDto[];
  projectTeamMembersByRole: UsersByRoleDto[];
  monthlyHoursBreakdownByCategory: LabelValueDto[];
  hoursByStage: LabelValueDto[];
  deliveryMetrics: LabelValueDto[];
}

export interface DashboardOverviewDto {
  summary: DashboardSummaryDto;
  charts: DashboardChartsDto;
}

export interface DashboardFilterParams {
  year?: number;
  month?: number;
  topN?: number;
  ytd?: boolean;
  projectStatus?: string;
  projectPhase?: string;
  processStatus?: string;
  departmentId?: string;
  roleId?: string;
  businessUnitId?: string;
  plantId?: string;
  plant?: string;
  projectManagerId?: string;
  projectType?: string;
  projectManagementType?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}

export interface DashboardPerformanceSummaryDto {
  totalLoggedHours: number;
  ytdLoggedHours: number;
  expectedHours: number;
  utilizationRate: number;
  averageHoursPerLoggedDay: number;
  loggedDays: number;
  projectsWithLoggedHours: number;
  assignedProjects: number;
  delayedAssignedProjects: number;
  premiumApprovedHours: number;
  premiumPendingHours: number;
  totalCost: number;
  annualGoalProgressPercentage: number;
}

export interface DashboardMonthlyHoursByCategoryDto {
  year: number;
  month: number;
  monthName: string;
  totalHours: number;
  executionHours: number;
  supervisionHours: number;
  processHours: number;
  managementHours: number;
  rAndDHours: number;
  workshopHours: number;
  otherHours: number;
  internManagementHours: number;
}

export interface DashboardPerformanceProjectDto {
  projectId: string;
  projectName: string;
  status: string;
  phase: string;
  totalHours: number;
  totalCost: number;
  projectProgressPercentage: number;
  estimatedDueDate: string | null;
  isDelayed: boolean;
}

export interface DashboardPerformanceChartsDto {
  hoursByCategory: LabelValueDto[];
  hoursByStage: LabelValueDto[];
  monthlyHoursByCategory: DashboardMonthlyHoursByCategoryDto[];
  premiumHours: LabelValueDto[];
}

export interface DashboardPerformanceDto {
  summary: DashboardPerformanceSummaryDto;
  charts: DashboardPerformanceChartsDto;
  topProjects: DashboardPerformanceProjectDto[];
}

export interface DashboardBiKpisDto {
  [key: string]: unknown;
}

export interface DashboardBiChartsDto {
  monthlyHoursByCategory?: unknown;
  performanceTrend?: unknown;
  hoursByCategory?: unknown;
  workloadByDepartment?: unknown;
  workloadByBusinessUnit?: unknown;
  estimatedVsActualProjects?: unknown;
  riskMatrix?: unknown;
  [key: string]: unknown;
}

export interface DashboardBiTablesDto {
  dueSoonProjects?: unknown;
  noRecentActivityProjects?: unknown;
  openRoadblocks?: unknown;
  [key: string]: unknown;
}

export interface DashboardAdminBiDto {
  filters: Record<string, unknown>;
  kpis: DashboardBiKpisDto;
  charts: DashboardBiChartsDto;
  tables: DashboardBiTablesDto;
  alerts: unknown[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ProjectFilterParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDescending?: boolean;
  status?: number;
  phase?: number;
  projectType?: number;
  departmentId?: string;
  businessUnitId?: string;
  projectManagerId?: string;
  Status?: number;
  Phase?: number;
  ProjectType?: number;
  ProjectManagementType?: number;
  DepartmentId?: string;
  BusinessUnitId?: string;
  ProjectManagerId?: string;
  PageNumber?: number;
  PageSize?: number;
  Search?: string;
  SortBy?: string;
  SortDescending?: boolean;
  UserId?: string;
  InternId?: string;
}
export interface DashboardExtendedSummaryDto {
  totalProjects: number;
  totalEstimatedHours: number;
  totalTrackedHours: number;
  ytdHours: number;
  averageOtd: number;
  averageEffectiveness: number;
  delayedProjects: number;
  doneProjectsBelowTarget: number;
  doneProjectsAboveTarget: number;
  totalUsers: number;
  activeUsers: number;
  approvedUsers: number;
  annualGoalProgressPercentage: number;
  projectsKpiDelta?: number;
  trackedHoursDeltaPercent?: number;
  delayedProjectsDelta?: number;
}

export interface DashboardExtendedPortfolioHealthDto {
  totalProjects: number;
  ongoingProjects: number;
  plannedProjects: number;
  onHoldProjects: number;
  doneProjects: number;
  delayedProjects: number;
  averageProgress: number;
  averageOtd: number;
  averageEffectiveness: number;
  projectsByStatus: LabelValueDto[];
  projectsByPhase: LabelValueDto[];
  performanceTrend?: any[];
  projectsByStatusBreakdown?: any;
  projectsByPhaseBreakdown?: any;
}

export interface DashboardExtendedWorkloadDto {
  totalTrackedHours: number;
  ytdHours: number;
  premiumApprovedHours: number;
  premiumPendingHours: number;
  monthlyHoursByCategory: any[];
  categoryBreakdown: LabelValueDto[];
  hoursByStage: LabelValueDto[];
  workloadByDepartment?: LabelValueDto[];
  workloadByBusinessUnit?: LabelValueDto[];
  workloadByRole?: LabelValueDto[];
}

export interface DashboardExtendedRisksDto {
  openRoadblocks: number;
  overdueRoadblocks: number;
  delayedProjects: number;
  onHoldProjects: number;
  dueSoonProjects: number;
}

export interface DashboardExtendedBusinessDto {
  totalBudget: number;
  totalCost: number;
  totalEstimatedHours: number;
  totalTrackedHours: number;
  totalCostSaving: number;
  totalDigitalContribution: number;
  budgetConsumptionPercentage: number;
  costSavingByDepartment?: LabelValueDto[];
  costSavingByBusinessUnit?: LabelValueDto[];
}

export interface DashboardExtendedUsersDto {
  totalUsers: number;
  activeUsers: number;
  approvedUsers: number;
  inactiveUsers: number;
  pendingApprovalUsers: number;
  usersByRole: any[];
}

export interface DashboardExtendedDto {
  summary: DashboardExtendedSummaryDto;
  portfolioHealth: DashboardExtendedPortfolioHealthDto;
  workload: DashboardExtendedWorkloadDto;
  users: DashboardExtendedUsersDto;
  risks: DashboardExtendedRisksDto;
  business: DashboardExtendedBusinessDto;
  topProjects: any[];
  alerts: any[];
}
