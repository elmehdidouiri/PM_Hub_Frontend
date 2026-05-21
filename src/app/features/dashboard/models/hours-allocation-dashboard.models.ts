export interface HoursAllocationOptionDto {
  id: string;
  label: string;
}

export interface HoursAllocationMonthOptionDto {
  value: number;
  label: string;
}

export interface HoursAllocationFiltersDto {
  users: HoursAllocationOptionDto[];
  projects: HoursAllocationOptionDto[];
  roles: HoursAllocationOptionDto[];
  members: HoursAllocationOptionDto[];
  fiscalYears: number[];
  months: HoursAllocationMonthOptionDto[];
}

export interface HoursAllocationDashboardParams {
  userId?: string | null;
  memberId?: string | null;
  projectId?: string | null;
  roleId?: string | null;
  year?: number | null;
  month?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  quickSelect?: 'month' | 'year' | 'ytd' | null;
  analysis?: 'resourcesCapacity' | 'team' | 'details' | 'projects' | 'roles' | 'projectUsers' | null;
  search?: string | null;
  pageNumber?: number | null;
  pageSize?: number | null;
  all?: boolean | null;
}

export interface HoursAllocationSummaryDto {
  totalHours: number;
  activeUsers: number;
  projects: number;
  allocations: number;
  averageUtilization: number;
  yearToDateHours: number;
  averageMonthlyHours: number;
  workedDays: number;
}

export interface HoursAllocationDetailDto {
  date: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  type: string;
  executionHours: number;
  techLeadHours: number;
  processHours: number;
  projectManagementHours: number;
  researchAndDevHours: number;
  workshopHours: number;
  otherHours: number;
  totalHours: number;
}

export interface HoursAllocationMonthlyDto {
  year: number;
  month: number;
  monthName: string;
  totalHours: number;
  utilizationPercentage: number;
}

export interface HoursAllocationByUserDto {
  userId: string;
  userName: string;
  role: string;
  department: string;
  allocatedHours: number;
  durationLabel: string;
  remainingHours: number;
  availableHours: number;
  utilizationPercentage: number;
  executionHours: number;
  techLeadHours: number;
  processHours: number;
  projectManagementHours: number;
  researchAndDevHours: number;
  workshopHours: number;
  projectCount: number;
  allocationCount: number;
}

export interface HoursAllocationByProjectDto {
  projectId: string;
  projectName: string;
  totalHours: number;
  projectManagerHours: number;
  teamHours: number;
  teamMembers: number;
  allocations: number;
}

export interface HoursAllocationByRoleDto {
  roleId: string;
  role: string;
  totalHours: number;
  teamMembers: number;
  percentage: number;
}

export interface HoursAllocationByTeamDto {
  memberId: string;
  memberName: string;
  projectName: string;
  totalHours: number;
  workedDays: number;
  allocationCount: number;
}

export interface HoursAllocationByProjectUserDto {
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  role: string;
  totalHours: number;
  executionHours: number;
  techLeadHours: number;
  processHours: number;
  projectManagementHours: number;
  researchAndDevHours: number;
  workshopHours: number;
  otherHours: number;
  workedDays: number;
  allocationCount: number;
  isProjectManager: boolean;
}

export interface HoursAllocationDashboardDto {
  summary: HoursAllocationSummaryDto;
  details: HoursAllocationDetailDto[];
  monthlyBreakdown: HoursAllocationMonthlyDto[];
  hoursByUser: HoursAllocationByUserDto[];
  hoursByProject: HoursAllocationByProjectDto[];
  hoursByRole: HoursAllocationByRoleDto[];
  hoursByTeam: HoursAllocationByTeamDto[];
  hoursByProjectUser: HoursAllocationByProjectUserDto[];
  pagination?: {
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
