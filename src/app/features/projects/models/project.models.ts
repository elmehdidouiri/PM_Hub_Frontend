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
  role: string;
}

export interface CreateProjectBudgetItemDto {
  itemName: string;
  pricePerUnit: number;
  quantity: number;
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
  description: string;
  status: ProjectStatus;
  statusLabel?: string;
  phase: ProjectPhase;
  phaseLabel?: string;
  processStatus: ProcessStatus;
  processStatusLabel?: string;
  startDate: string;
  endDate: string | null;
  estimatedDueDate: string | null;
  budget: number;
  digitalContribution: number | null;
  costSaving: number | null;
  estimatedHours: number | null;
  progressPercentage: number | null;
  projectManagerId: string | null;
  projectManagerName: string | null;
  sponsor: string;
  costCenter: string;
  codeSourceLink: string;
  solutionLink: string;
  serverHostName: string;
  projectManagementType: ProjectManagementType;
  projectManagementTypeLabel?: string;
  projectType: ProjectType;
  projectTypeLabel?: string;
  currentState: string;
  roadblocks: string;
  nextSteps: string;
  enhancements: string;
  departmentId: string;
  departmentName: string;
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
    roleName: string;
  }>;
  kpIs: Array<{
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
}

export interface ProjectSummaryDto {
  id: string;
  name: string;
  description: string;
  projectType: ProjectType;
  projectTypeLabel?: string;
  sponsor: string;
  status: ProjectStatus;
  statusLabel?: string;
  phase: ProjectPhase;
  phaseLabel?: string;
  departmentName: string;
  plantName: string;
  estimatedHours: number | null;
  actualHours: number | null;
  projectManagerName: string | null;
  projectManagerId: string | null;
  startDate: string;
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

export interface DashboardFilterParams {
  year?: number;
  month?: number;
  topN?: number;
  projectStatus?: string;
  projectPhase?: string;
  processStatus?: string;
  departmentId?: string;
  roleId?: string;
  businessUnitId?: string;
  plant?: string;
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
}
