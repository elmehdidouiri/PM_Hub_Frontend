// ─── Booking Target Comparison – Frontend DTOs ────────────────────────────────
// Mirrors the backend BookingTargetComparisonDto (Clean Architecture / Analytics)

export type CalculationMode = 'Brut' | 'Net';
export type PeriodMode = 'ytd' | 'fiscal_year' | 'month';

// ── Query Parameters ──────────────────────────────────────────────────────────
export interface BookingTargetComparisonQuery {
  fiscalYear?: number;
  periodMode?: PeriodMode;
  month?: number;
  year?: number;
  calculationMode?: CalculationMode;
  hourlyRate?: number;
  targetHoursPerMember?: number;
  projectId?: string;
  departmentId?: string;
  businessUnitId?: string;
  plantId?: string;
}

// ── Population summary (Employees / Subcontractors / Interns / Total) ─────────
export interface BookingPopulationDto {
  /** Population label: 'Employees', 'Subcontractors', 'Interns', 'Total' */
  label: string;
  headcount: number;

  // Hours
  bookedHours: number;
  targetHours: number;
  remainingHours: number;
  hoursAchievementPercent: number;

  // Hours Net / Gross (meaningful for Employees only; equal for others)
  grossBookedHours: number;
  netBookedHours: number;

  // Revenue
  bookedRevenue: number;
  targetRevenue: number;
  remainingRevenue: number;
  revenueAchievementPercent: number;

  // Revenue Net / Gross
  grossRevenue: number;
  netRevenue: number;
}

// ── One data point in the monthly time-series ──────────────────────────────────
export interface BookingMonthlyTrendPoint {
  fiscalMonth: number;     // 1 = first month of fiscal year
  year: number;
  month: number;           // calendar month 1-12
  monthName: string;       // 'Oct', 'Nov', ...

  // Monthly values
  bookedHours: number;
  targetHours: number;
  bookedRevenue: number;
  targetRevenue: number;
  grossBookedHours: number;
  netBookedHours: number;

  // Cumulative YTD values (for cumulative area chart)
  cumulativeBookedHours: number;
  cumulativeTargetHours: number;
  cumulativeBookedRevenue: number;
  cumulativeTargetRevenue: number;
  cumulativeGrossBookedHours: number;
  cumulativeNetBookedHours: number;
}

// ── Top-level response ─────────────────────────────────────────────────────────
export interface BookingTargetComparisonDto {
  // Period metadata
  fiscalYear: number;
  periodMode: PeriodMode;
  startDate: string;
  endDate: string;
  calculationMode: CalculationMode;
  hourlyRate: number;

  // Summary by population
  summary: {
    employees: BookingPopulationDto;
    subcontractors: BookingPopulationDto;
    interns: BookingPopulationDto;
    total: BookingPopulationDto;
  };

  // Monthly time-series (ordered by fiscal month)
  monthlyTrend: BookingMonthlyTrendPoint[];
}
