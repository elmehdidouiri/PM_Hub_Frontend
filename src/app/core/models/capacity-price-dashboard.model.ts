export interface CapacityPriceQueryDto {
  year?: number;
  month?: number;
  targetHoursPerMember?: number;
  targetHoursPerIntern?: number;
  hourlyRate?: number;           
}

export interface MemberCapacityDto {
  userId: string;
  userName: string;
  memberType: 'Employee' | 'Subcontractor' | string;
  bookedHours: number;
  targetHours: number;
  remainingHours: number;
  varianceHours: number;
  percentage: number;
}

export interface CapacityTargetDto {
  actualBookedHours: number;
  targetHours: number;
  remainingHours: number;
  varianceHours: number;
  achievementPercentage: number;
}

export interface MemberPriceDto {
  userId: string;
  userName: string;
  memberType: 'Employee' | 'Subcontractor' | string;
  bookedPrice: number;
  targetPrice: number;
  remainingPrice: number;
  variancePrice: number;
  percentage: number;
}

export interface PriceTargetDto {
  bookedPrice: number;
  remainingPrice: number;
  targetPrice: number;
  variancePrice: number;
  achievementPercentage: number;
}

export interface MemberCountsDto {
  employeeCount: number;
  internCount: number;
  subcontractorCount: number;
}

export interface CapacityPriceDashboardDto {
  memberCapacities: MemberCapacityDto[];
  capacityTarget: CapacityTargetDto;
  memberPrices: MemberPriceDto[];
  priceTarget: PriceTargetDto;
  memberCounts: MemberCountsDto;
}

export interface InternDetailDto {
  internId: string;
  internName: string;
  role: string;
  supervisorName: string;
  bookedHours: number;
  targetHours: number;
  remainingHours: number;
  directBookedHours: number;
  supervisionHours: number;
  progressionPercentage: number;
  bookedPrice: number;
  targetPrice: number;
  remainingPrice: number;
  entriesCount: number;
}

export interface ProjectDetailDto {
  projectId: string;
  projectName: string;
  bookedHours: number;
  bookedPrice: number;
  internsCount: number;
  entriesCount: number;
}

export interface InternCapacityPriceAnalyticsDto {
  totalInterns: number;
  activeInternsWithEntries: number;
  capacityTarget: CapacityTargetDto;
  priceTarget: PriceTargetDto;
  internDetails: InternDetailDto[];
  projectDetails: ProjectDetailDto[];
}

export type MemberTypeEnum = 1 | 2 | 3;

export interface MemberTahSummaryDto {
  employeeCount: number;
  subcontractorCount: number;
  averageEffectiveness: number;
  cumulativeTahHours: number;
  employeeTahHours: number;
  subcontractorTahHours: number;
  employeeSharePercentage: number;
  subcontractorSharePercentage: number;
}

export interface MemberTahMonthlyBreakdownDto {
  year: number;
  month: number;
  monthName: string;
  employeeCount: number;
  subcontractorCount: number;
  averageEffectiveness: number;
  tahHours: number;
  employeeTahHours: number;
  subcontractorTahHours: number;
  employeeSharePercentage: number;
  subcontractorSharePercentage: number;
}

export interface MemberTahMemberMonthDto {
  year: number;
  month: number;
  monthName: string;
  bookedHours: number;
  effectiveness: number;
  tahHours: number;
}

export interface MemberTahMemberDto {
  userId: string;
  userName: string;
  memberType: MemberTypeEnum;
  memberTypeLabel: "TE" | "Subcontractor";
  bookedHours: number;
  effectiveness: number;
  tahHours: number;
  monthly: MemberTahMemberMonthDto[];
}

export interface AnalyticsPeriod {
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

export interface MemberTahQuery {
  month?: number;
  year?: number;
  fiscalYear?: number;
  periodMode?: string;
  quickSelect?: string;
  userId?: string;
  projectId?: string;
  departmentId?: string;
  businessUnitId?: string;
  plantId?: string;
  projectStatus?: string;
  projectPhase?: string;
  tahMonthlyHoursTarget?: number;
}

export interface MemberTahDashboardDto {
  period: AnalyticsPeriod; 
  tahMonthlyHoursTarget: number;
  summary: MemberTahSummaryDto;
  monthlyBreakdown: MemberTahMonthlyBreakdownDto[];
  members: MemberTahMemberDto[];
}
