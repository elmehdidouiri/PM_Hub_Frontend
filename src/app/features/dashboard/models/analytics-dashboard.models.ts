export interface AnalyticsPeriodDto {
  year: number;
  month: number;
  monthName: string;
  startDate: string;
  endDate: string;
  fiscalYear: number;
  fiscalYearStartMonth: number;
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
}

export interface AnalyticsSummaryDto {
  averageEffectiveness: number;
  averageOtd: number;
  averageCsat: number;
  totalProjects: number;
  projectsWithData: number;
  totalHours: number;
  ytdHours: number;
  averageMonthlyHours: number;
  averageUtilization: number;
  activeTeamMembers: number;
}

export interface AnalyticsMonthlyKpiDto {
  year: number;
  month: number;
  monthName: string;
  effectiveness: number;
  otd: number;
  csat: number;
  projectsWithData: number;
}

export interface AnalyticsMonthlyHoursDto {
  year: number;
  month: number;
  monthName: string;
  executionHours: number;
  technicalSupervisionHours: number;
  processHours: number;
  projectManagementHours: number;
  researchAndDevHours: number;
  workshopHours: number;
  otherHours: number;
  internManagementHours: number;
  totalHours: number;
  /** Server-calculated capacity target; interns are excluded. */
  activeNonInternMembers: number;
  targetHoursPerMember: number;
  targetHours: number;
}

export interface AnalyticsUtilizationDto {
  year: number;
  month: number;
  monthName: string;
  loggedHours: number;
  targetHours: number;
  utilizationPercentage: number;
}

export interface AnalyticsDashboardDto {
  period: AnalyticsPeriodDto;
  summary: AnalyticsSummaryDto;
  kpis: {
    monthlyTrend: AnalyticsMonthlyKpiDto[];
  };
  hours: {
    monthlyByCategory: AnalyticsMonthlyHoursDto[];
    utilizationTrend: AnalyticsUtilizationDto[];
    byBusinessUnit: Array<{ label: string; hours: number }>;
  };
}

export interface AnalyticsOptionDto {
  id: string;
  label: string;
}

export interface AnalyticsMonthOptionDto {
  value: number;
  label: string;
}

export interface AnalyticsFiltersDto {
  fiscalYears: number[];
  months: AnalyticsMonthOptionDto[];
  users: AnalyticsOptionDto[];
  projects: AnalyticsOptionDto[];
  departments: AnalyticsOptionDto[];
  businessUnits: AnalyticsOptionDto[];
  plants?: AnalyticsOptionDto[];
}

export interface AnalyticsDashboardParams {
  month?: number | null;
  year?: number | null;
  fiscalYear?: number | null;
  periodMode?: string | null;
  quickSelect?: string | null;
  userId?: string | null;
  projectId?: string | null;
  departmentId?: string | null;
  businessUnitId?: string | null;
  plantId?: string | null;
  projectStatus?: string | number | null;
  projectPhase?: string | number | null;
}

export interface ProjectCapacityPriceSummaryDto {
  totalProjects: number;
  bookedCapacity: number;
  targetCapacity: number;
  remainingCapacity: number;
  varianceCapacity: number;
  capacityPercentage: number;
  bookedCost: number;
  targetCost: number;
  remainingCost: number;
  varianceCost: number;
  costPercentage: number;
}

export interface ProjectCapacityPriceRowDto {
  projectId: string;
  projectName: string;
  projectStatus: string;
  bookedCapacity: number;
  targetCapacity: number;
  remainingCapacity: number;
  varianceCapacity: number;
  capacityPercentage: number;
  bookedCost: number;
  targetCost: number;
  remainingCost: number;
  varianceCost: number;
  costPercentage: number;
}

export interface ProjectCapacityPriceAnalyticsDto {
  summary: ProjectCapacityPriceSummaryDto;
  projects: ProjectCapacityPriceRowDto[];
}
