/**
 * DTOs aligned with POST/PUT /api/hour-entries (OpenAPI).
 */

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

export interface CreateHourEntryDto {
  bookingType: number;
  allocationFrequency: number;
  dateSelectionMode: number;

  selectedDates: string[];
  rangeStartDate?: string;
  rangeEndDate?: string;

  category: number;
  projectId?: string;

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
  projectId?: string;
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
  notes?: string | null;
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
  targetHours: number;
  loggedHours: number;
  variance: number;
  totalInternManagementHours: number;
}

export interface MonthlyHoursDashboardDto {
  month: number;
  totalExecutionHours: number;
  totalSupervisionHours: number;
  totalProcessHours: number;
  totalManagementHours: number;
  totalRAndDHours: number;
  totalWorkshopHours: number;
  totalOtherHours: number;
  totalInternManagementHours: number;
}

export interface YtdDashboardDto {
  monthlyBreakdown: MonthlyHoursDashboardDto[];
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
