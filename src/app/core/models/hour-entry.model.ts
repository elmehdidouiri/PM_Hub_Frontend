 

export enum BookingType {
  Normal = 0,
  Premium = 1,
}

export enum AllocationFrequency {
  Daily = 0,
  Weekly = 1,
}

export enum DateSelectionMode {
  SingleDay = 0,
  MultipleDays = 1,
  WeekRange = 2,
}



export interface InternSupervisionDto {
  internAllocationId: string;
  hours: number;
}

export interface DetailInternSupervisionDto {
  internId: string;
  internName: string;
  hours: number;
}

export interface CreateHourEntryDto {
  bookingType: number;
  allocationFrequency: number;
  dateSelectionMode: number;

  selectedDates: string[];
  rangeStartDate?: string;
  rangeEndDate?: string;

  category: number;
  projectId?: string | null;
  totalHours?: number;
  activityNote?: string | null;

  executionHours: number;
  technicalSupervisionHours: number;
  processRelatedHours: number;
  projectManagementHours: number;
  researchAndDevHours: number;
  workshopHours: number;
  otherActivitiesHours: number;

  internManagementHours: number;
  supervisedInterns: InternSupervisionDto[];

  notes?: string | null;
}

export type HourEntryCreateDto = CreateHourEntryDto;

export interface HourEntryUpdateDto {
  bookingType: number;
  executionHours: number;
  supervisionHours: number;
  processHours: number;
  managementHours: number;
  rAndDHours: number;
  workshopHours: number;
  otherHours: number;
  notes?: string | null;
}

export interface HourEntryPremiumApproveDto {
  hourEntryId: string;
  isApproved: boolean;
}

/** Response item for GET /hour-entries/my, /my/date, /my/month, /project/{id} — extend if the API returns more fields */
export interface HourEntryDto {
  id: string;
  userId?: string;
  userFullName?: string;
  projectId?: string;
  projectName?: string;
  allocationType?: number;
  projectType?: number;
  bookingType?: number;
  date?: string;
  executionHours?: number;
  supervisionHours?: number;
  processHours?: number;
  managementHours?: number;
  rAndDHours?: number;
  workshopHours?: number;
  otherHours?: number;
  internManagementHours?: number;
  totalHours?: number;
  hourlyRate?: number;
  totalCost?: number;
  currency?: string;
  isPremium?: boolean;
  premiumReason?: string | null;
  premiumApprovalStatus?: string | null;
  notes?: string | null;
  supervisedInterns?: DetailInternSupervisionDto[];
  createdAt?: string;
  updatedAt?: string | null;
}

export interface HourEntryMyProjectDto {
  projectId?: string;
  id?: string;
  name?: string;
  projectName?: string;
  title?: string;
}

export interface ProjectInternAllocationDto {
  internAllocationId: string;
  internName: string;
}

export interface HourEntryDashboardMonthlyDto {
  year?: number;
  month?: number;
  monthName?: string;
  loggedHours: number;
  targetHours: number;
  variance: number;
  totalCost?: number;
  workingDays?: number;
  dailyTarget?: number;
  daysLeft?: number;
  dailyNeeded?: number;
  progress?: number;
  premiumHours?: number;
  premiumPendingHours?: number;
  totalExecutionHours?: number;
  totalSupervisionHours?: number;
  totalProcessHours?: number;
  totalManagementHours?: number;
  totalRAndDHours?: number;
  totalWorkshopHours?: number;
  totalOtherHours?: number;
  totalInternManagementHours: number;
  entries?: HourEntryDto[];
  isOnTrack?: boolean;
  status?: string;
}

export interface MonthlyHoursDashboardDto {
  year: number;
  month: number;
  monthName: string;
  loggedHours: number;
  targetHours: number;
  variance: number;
  totalCost: number;
  workingDays: number;
  dailyTarget: number;
  daysLeft: number;
  dailyNeeded: number;
  progress: number;
  premiumHours: number;
  premiumPendingHours: number;
  totalExecutionHours: number;
  totalSupervisionHours: number;
  totalProcessHours: number;
  totalManagementHours: number;
  totalRAndDHours: number;
  totalWorkshopHours: number;
  totalOtherHours: number;
  totalInternManagementHours: number;
  entries: HourEntryDto[];
  isOnTrack: boolean;
  status: string;
}

export interface YtdDashboardDto {
  companyYear: number;
  fiscalYearLabel: string;
  ytdHours: number;
  expectedHours: number;
  variance: number;
  projectedYearEnd: number;
  monthlyRecommendation: number;
  ytdCost: number;
  premiumHours: number;
  premiumApprovedCost: number;
  premiumPendingHours: number;
  monthlyBreakdown: MonthlyHoursDashboardDto[];
  completionPercentage: number;
  performanceStatus: string;
}

export function resolveMyProjectOption(row: unknown): { projectId: string; label: string } | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const o = row as Record<string, unknown>;
  const rawId = o['projectId'] ?? o['id'] ?? o['Id'];
  const projectId = typeof rawId === 'string' ? rawId : null;
  if (!projectId) {
    return null;
  }
  const rawName = o['projectName'] ?? o['name'] ?? o['Name'] ?? o['title'] ?? o['Title'];
  const label =
    typeof rawName === 'string' && rawName.trim()
      ? rawName.trim()
      : projectId;
  return { projectId, label };
}

export function resolveInternAllocationOption(row: unknown): { internAllocationId: string; label: string } | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const o = row as Record<string, unknown>;
  const rawId = o['internAllocationId'] ?? o['InternAllocationId'] ?? o['id'] ?? o['Id'];
  const internAllocationId = typeof rawId === 'string' ? rawId : null;
  if (!internAllocationId) {
    return null;
  }
  const rawName = o['internName'] ?? o['InternName'] ?? o['name'] ?? o['Name'];
  const label = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : internAllocationId;
  return { internAllocationId, label };
}

/** Placeholder options until backend documents enum labels */
export const HOUR_ENTRY_TYPE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: '0 — default' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];
