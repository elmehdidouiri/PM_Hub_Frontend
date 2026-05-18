import { Injectable } from '@angular/core';
import { MonthlyHoursDashboardDto, YtdDashboardDto } from '../../../core/models/hour-entry.model';
import {
  DashboardAdminBiDto,
  DashboardExtendedDto,
  DashboardOverviewDto,
  DashboardPerformanceDto,
} from '../../projects/models';

// ─── Shared view-model interfaces ────────────────────────────────────────────
export interface ChartBar {
  label: string;
  value: number;
  percent: number;
}

export interface BiTrendPoint {
  label: string;
  otd: number;
  effectiveness: number;
}

export interface BiScatterPoint {
  label: string;
  x: number;
  y: number;
  size: number;
}

export interface BiActionItem {
  title: string;
  meta: string;
  value: string;
  severity: string;
}

export interface BiAlertItem {
  title: string;
  message: string;
  severity: string;
}

export interface MetricCard {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone?: 'blue' | 'teal' | 'green' | 'orange' | 'red' | 'purple' | '';
  delta?: number;
  progress?: number;
}

export interface MonthlyEffortTrendItem {
  monthName: string;
  total: number;
  categories: Array<{ label: string; value: number; color: string; percent: number }>;
}

export interface EffortDistributionResult {
  effortDistribution: ChartBar[];
  monthlyEffortTrend: MonthlyEffortTrendItem[];
  totalHoursYtd: number;
}

/**
 * DashboardCalculationService – Phase 3 SOLID refactor (SRP / OCP).
 *
 * Responsibility: all pure data-transformation logic for the dashboard.
 * The component becomes a thin orchestrator that only wires data to the template.
 *
 * Every method is pure (no side-effects on Angular state) so it is trivial
 * to unit-test without Angular TestBed.
 */
@Injectable({ providedIn: 'root' })
export class DashboardCalculationService {

  // ─── Shared View Models Mapping ────────────────────────────────────────────

  /** Category palette used across all effort charts */
  static readonly CATEGORY_DEFS = [
    { keys: ['totalExecutionHours', 'executionHours'], label: 'Execution', color: '#f47c00' },
    { keys: ['totalSupervisionHours', 'totalTechnicalSupervisionHours', 'supervisionHours'], label: 'Supervision', color: '#3b82f6' },
    { keys: ['totalProcessHours', 'totalProcessRelatedHours', 'processHours'], label: 'Process', color: '#6366f1' },
    { keys: ['totalManagementHours', 'totalProjectManagementHours', 'managementHours'], label: 'Management', color: '#8b5cf6' },
    { keys: ['totalRAndDHours', 'totalResearchAndDevHours', 'rAndDHours'], label: 'R&D', color: '#ec4899' },
    { keys: ['totalWorkshopHours', 'workshopHours'], label: 'Workshop', color: '#14b8a6' },
    { keys: ['totalOtherHours', 'totalOtherActivitiesHours', 'otherHours'], label: 'Other', color: '#64748b' },
    { keys: ['totalInternManagementHours', 'internManagementHours'], label: 'Interns', color: '#06b6d4' },
  ];

  // ─── Effort distribution ─────────────────────────────────────────────────

  computeEffortDistribution(
    ytd: YtdDashboardDto,
  ): EffortDistributionResult {
    return this.computeMonthlyEffortDistribution(ytd.monthlyBreakdown, Number(ytd.ytdHours ?? 0));
  }

  computeMonthlyEffortDistribution(
    monthlyBreakdownSource: MonthlyHoursDashboardDto[] | null | undefined,
    fallbackTotalHours = 0,
    fallbackCategoryEntries: Array<{ label: string; value: number }> = [],
  ): EffortDistributionResult {
    const monthlyBreakdown = Array.isArray(monthlyBreakdownSource) ? monthlyBreakdownSource : [];
    const defs = DashboardCalculationService.CATEGORY_DEFS;

    // 1. Calculate grand totals per category
    const totals = defs.reduce((acc, d) => ({ ...acc, [d.label]: 0 }), {} as Record<string, number>);
    monthlyBreakdown.forEach((m) => {
      defs.forEach((d) => {
        totals[d.label] += this.readNumber(m as unknown as Record<string, unknown>, d.keys);
      });
    });

    const entries = Object.entries(totals).map(([label, value]) => ({ label, value }));
    const calculatedTotal = entries.reduce((s, e) => s + e.value, 0);
    const fallbackCategoryTotal = fallbackCategoryEntries.reduce((s, e) => s + e.value, 0);

    const distributionEntries = calculatedTotal > 0 ? entries : fallbackCategoryEntries;
    const totalHours = calculatedTotal || fallbackCategoryTotal || fallbackTotalHours;

    const effortDistribution: ChartBar[] = distributionEntries
      .map((e) => ({
        ...e,
        percent: totalHours > 0 ? Math.round((e.value / totalHours) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // 2. Monthly trend
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyEffortTrend: MonthlyEffortTrendItem[] = MONTH_NAMES.map((monthName, idx) => {
      const monthData = monthlyBreakdown.find((m) => Number(m.month ?? 0) === idx + 1);
      const catData = defs.map((d) => ({
        label: d.label,
        value: monthData ? this.readNumber(monthData as unknown as Record<string, unknown>, d.keys) : 0,
        color: d.color,
      }));
      const monthTotal = catData.reduce((s, c) => s + c.value, 0);
      return {
        monthName,
        total: monthTotal,
        categories: catData.map((c) => ({
          ...c,
          percent: monthTotal > 0 ? (c.value / monthTotal) * 100 : 0,
        })),
      };
    });

    return { effortDistribution, monthlyEffortTrend, totalHoursYtd: totalHours };
  }

  // ─── Chart bar helpers ────────────────────────────────────────────────────

  withPercent(entries: Array<{ label: string; value: number }>): ChartBar[] {
    const sanitized = entries.filter((e) => Number.isFinite(e.value) && e.value >= 0);
    const max = sanitized.reduce((acc, e) => Math.max(acc, e.value), 0);
    if (!max) return sanitized.map((e) => ({ ...e, percent: 0 }));
    return sanitized.map((e) => ({
      ...e,
      percent: e.value > 0 ? Math.max(6, (e.value / max) * 100) : 0,
    }));
  }

  withScorePercent(entries: Array<{ label: string; value: number }>): ChartBar[] {
    return entries
      .filter((e) => Number.isFinite(e.value) && e.value >= 0)
      .map((e) => ({ ...e, percent: this.clampPercent(e.value) }));
  }

  // ─── Entry parsing ────────────────────────────────────────────────────────

  toEntries(source: unknown): Array<{ label: string; value: number }> {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            label: String(row['label'] ?? row['name'] ?? row['key'] ?? '').trim(),
            value: Number(row['value'] ?? row['count'] ?? 0),
          };
        })
        .filter((e) => e.label && e.label !== 'N/A' && Number.isFinite(e.value) && e.value > 0);
    }
    if (typeof source === 'object') {
      return Object.entries(source as Record<string, unknown>)
        .map(([label, value]) => ({ label, value: Number(value ?? 0) }))
        .filter((e) => e.label && e.label !== 'N/A' && Number.isFinite(e.value) && e.value > 0);
    }
    return [];
  }

  toProjectEntries(
    source: unknown,
    projectNameById: Map<string, string> = new Map(),
  ): Array<{ label: string; value: number }> {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          const projectId = this.readString(row, ['projectId', 'id', 'Id']);
          const resolvedName = projectId ? projectNameById.get(projectId) ?? '' : '';
          return {
            label: String(row['label'] ?? row['name'] ?? row['projectName'] ?? resolvedName ?? 'N/A'),
            value: Number(row['value'] ?? row['count'] ?? row['hours'] ?? row['totalHours'] ?? 0),
          };
        })
        .filter((e) => e.label !== 'N/A' && Number.isFinite(e.value) && e.value >= 0);
    }
    return this.toEntries(source);
  }

  toRoleEntries(source: unknown): Array<{ label: string; value: number }> {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            label: String(row['label'] ?? row['roleName'] ?? row['name'] ?? 'N/A'),
            value: Number(row['value'] ?? row['count'] ?? 0),
          };
        })
        .filter((e) => e.label !== 'N/A' && Number.isFinite(e.value) && e.value >= 0);
    }
    return this.toEntries(source);
  }

  firstNonEmptyEntries(...candidates: Array<Array<{ label: string; value: number }>>): Array<{ label: string; value: number }> {
    return candidates.find((c) => c.length > 0) ?? [];
  }

  // ─── Metric formatting ────────────────────────────────────────────────────

  formatMetric(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
    return value.toFixed(1).replace(/\.0$/, '');
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
    return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  }

  // ─── BI chart helpers ─────────────────────────────────────────────────────

  toPerformanceTrend(source: unknown): BiTrendPoint[] {
    if (!Array.isArray(source)) return [];
    return source
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          label: this.readString(row, ['label', 'monthName', 'month', 'period']) || 'N/A',
          otd: this.clampPercent(this.readNumber(row, ['otd', 'averageOtd', 'onTimeDelivery'])),
          effectiveness: this.clampPercent(this.readNumber(row, ['effectiveness', 'averageEffectiveness', 'progress'])),
        };
      })
      .filter((p) => p.label !== 'N/A' || p.otd > 0 || p.effectiveness > 0);
  }

  toScatterPoints(source: unknown, xKeys: string[], yKeys: string[]): BiScatterPoint[] {
    if (!Array.isArray(source)) return [];
    return source
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          label: this.readString(row, ['label', 'projectName', 'name', 'riskName']) || 'N/A',
          x: this.readNumber(row, xKeys),
          y: this.readNumber(row, yKeys),
          size: Math.max(8, this.readNumber(row, ['size', 'value', 'score', 'severity']) || 12),
        };
      })
      .filter((p) => p.label !== 'N/A' || p.x > 0 || p.y > 0);
  }

  toActionItems(source: unknown): BiActionItem[] {
    if (!Array.isArray(source)) return [];
    return source.slice(0, 6).map((item) => {
      const row = item as Record<string, unknown>;
      const num = this.readNumber(row, ['value', 'delayDays', 'days', 'age']);
      let displayValue = '';
      if (num >= 999) displayValue = 'Jamais actif';
      else if (num > 0) displayValue = `${Math.floor(num)}d`;
      else displayValue = this.readString(row, ['dueDate', 'estimatedDueDate', 'lastActivityDate', 'createdAt']) || '';
      return {
        title: this.readString(row, ['projectName', 'name', 'title', 'roadblock']) || 'Untitled',
        meta: this.readString(row, ['status', 'phase', 'departmentName', 'owner']) || 'Portfolio',
        value: displayValue,
        severity: this.readString(row, ['severity', 'priority', 'status']) || 'medium',
      };
    });
  }

  toAlerts(source: unknown[]): BiAlertItem[] {
    return source.slice(0, 5).map((item) => {
      const row = item as Record<string, unknown>;
      return {
        title: this.readString(row, ['title', 'label', 'type']) || 'Attention',
        message: this.readString(row, ['message', 'description', 'text']) || `${item ?? ''}`,
        severity: this.readString(row, ['severity', 'level', 'status']) || 'info',
      };
    });
  }

  toMonthlyWorkloadTrend(source: unknown): any[] {
    if (!Array.isArray(source)) return [];
    return source.map((m) => ({
      monthName: m.monthName || m.month,
      total: m.totalHours || m.value || 0,
      estimated: m.estimatedHours || 0,
      cost: m.cost || 0,
    }));
  }

  // ─── Trend polyline (SVG) ─────────────────────────────────────────────────

  buildTrendPolyline(trend: BiTrendPoint[], key: 'otd' | 'effectiveness'): string {
    if (!trend.length) return '';
    const lastIndex = Math.max(1, trend.length - 1);
    return trend
      .map((point, idx) => {
        const x = 8 + (idx / lastIndex) * 84;
        const y = 92 - (this.clampPercent(point[key]) / 100) * 84;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  scaleToChart(value: number, values: number[], fallbackMax?: number): number {
    const validValues = values.filter((v) => Number.isFinite(v) && v >= 0);
    const max = Math.max(fallbackMax ?? 0, ...validValues, value, 1);
    return Math.max(8, Math.min(92, (value / max) * 84 + 8));
  }

  // ─── DTO adapters ─────────────────────────────────────────────────────────

  dashboardExtendedToOverview(ext: DashboardExtendedDto): DashboardOverviewDto {
    const summary = ext.summary || {};
    const health = ext.portfolioHealth || {};
    const workload = ext.workload || {};
    return {
      summary: {
        totalProjects: summary.totalProjects || 0,
        totalEstimatedHours: summary.totalEstimatedHours || 0,
        totalTrackedHours: summary.totalTrackedHours || 0,
        ytdHours: summary.ytdHours || 0,
        averageOtd: summary.averageOtd || 0,
        averageEffectiveness: summary.averageEffectiveness || 0,
        delayedProjects: summary.delayedProjects || 0,
        totalUsers: summary.totalUsers || 0,
        activeUsers: summary.activeUsers || 0,
        approvedUsers: summary.approvedUsers || 0,
        annualGoalProgressPercentage: summary.annualGoalProgressPercentage || 0,
      },
      charts: {
        projectsByStatus: health.projectsByStatus || [],
        projectsByPhase: health.projectsByPhase || [],
        topProjectsByHours: [],
        usersByRole: [],
        projectTeamMembersByRole: [],
        monthlyHoursBreakdownByCategory: workload.categoryBreakdown || [],
        hoursByStage: workload.hoursByStage || [],
        deliveryMetrics: [
          { label: 'OTD', value: summary.averageOtd || 0 },
          { label: 'Effectiveness', value: summary.averageEffectiveness || 0 },
        ],
      },
    };
  }

  dashboardBiToOverview(bi: DashboardAdminBiDto): DashboardOverviewDto {
    const kpis = bi.kpis ?? {};
    const charts = bi.charts ?? {};
    const totalProjects = this.readKpiNumber(kpis, ['totalProjects', 'projects', 'projectCount']);
    const totalTrackedHours = this.readKpiNumber(kpis, ['totalTrackedHours', 'trackedHours', 'actualHours']);
    const totalEstimatedHours = this.readKpiNumber(kpis, ['totalEstimatedHours', 'estimatedHours']);
    const ytdHours = this.readKpiNumber(kpis, ['ytdHours', 'totalHoursYtd']);
    const averageOtd = this.readKpiNumber(kpis, ['averageOtd', 'avgOtd', 'otd']);
    const averageEffectiveness = this.readKpiNumber(kpis, ['averageEffectiveness', 'avgEffectiveness', 'effectiveness']);
    const delayedProjects = this.readKpiNumber(kpis, ['delayedProjects', 'lateProjects', 'delayed']);
    return {
      summary: {
        totalProjects, totalEstimatedHours, totalTrackedHours, ytdHours,
        averageOtd, averageEffectiveness, delayedProjects,
        totalUsers: this.readKpiNumber(kpis, ['totalUsers']),
        activeUsers: this.readKpiNumber(kpis, ['activeUsers']),
        approvedUsers: this.readKpiNumber(kpis, ['approvedUsers']),
        annualGoalProgressPercentage: this.readKpiNumber(kpis, ['annualGoalProgressPercentage', 'annualGoalProgress']),
      },
      charts: {
        projectsByStatus: this.toEntries(charts['projectsByStatus']),
        projectsByPhase: this.toEntries(charts['projectsByPhase']),
        topProjectsByHours: this.toEntries(charts['topProjectsByHours']).map((e) => ({
          projectId: e.label, projectName: e.label, value: e.value,
        })),
        usersByRole: [],
        projectTeamMembersByRole: this.toEntries(charts['projectTeamMembersByRole']).map((e) => ({
          roleId: e.label, roleName: e.label, value: e.value,
        })),
        monthlyHoursBreakdownByCategory: this.toEntries(charts['hoursByCategory']),
        hoursByStage: this.toEntries(charts['hoursByStage']),
        deliveryMetrics: this.firstNonEmptyEntries(
          this.toEntries(charts['deliveryMetrics']),
          [{ label: 'OTD', value: averageOtd }, { label: 'Effectiveness', value: averageEffectiveness }],
        ),
      },
    };
  }

  buildEmptyCalendarMonths(year: number, monthOptions: Array<{ id: number; label: string }>): MonthlyHoursDashboardDto[] {
    return monthOptions.map((m) => ({
      year, month: m.id, monthName: m.label,
      loggedHours: 0, targetHours: 0, variance: 0, totalCost: 0,
      workingDays: 0, dailyTarget: 0, daysLeft: 0, dailyNeeded: 0, progress: 0,
      premiumHours: 0, premiumPendingHours: 0, totalExecutionHours: 0,
      totalSupervisionHours: 0, totalProcessHours: 0, totalManagementHours: 0,
      totalRAndDHours: 0, totalWorkshopHours: 0, totalOtherHours: 0,
      totalInternManagementHours: 0, entries: [], isOnTrack: false, status: '',
    }));
  }

  kpiNoteExtended(ext: DashboardExtendedDto | null, key: string, fallback: string): string {
    const raw = (ext?.summary as any)?.[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const record = raw as Record<string, unknown>;
    const delta = this.toMaybeNumber(record['delta'] ?? record['variance'] ?? record['change']);
    if (delta === null || delta === 0) return fallback;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1).replace(/\.0$/, '')} vs previous period`;
  }

  toMaybeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  getCatColor(label: string): string {
    const colorMap: Record<string, string> = {
      Execution: '#f47c00', Supervision: '#3b82f6', Process: '#6366f1',
      Management: '#8b5cf6', 'R&D': '#ec4899', Workshop: '#14b8a6',
      Other: '#94a3b8', Interns: '#06b6d4',
    };
    return colorMap[label] || this.getToneColor(label);
  }

  getToneColor(tone: string): string {
    const tones: Record<string, string> = {
      blue: '#3b82f6',
      teal: '#14b8a6',
      green: '#10b981',
      orange: '#f59e0b',
      red: '#ef4444',
      purple: '#8b5cf6',
      slate: '#64748b',
    };
    return tones[tone.toLowerCase()] || '#cbd5e1';
  }

  getPaletteColor(index: number): string {
    const colors = ['#2563eb', '#0f766e', '#f47c00', '#8b5cf6', '#db2777', '#64748b'];
    return colors[index % colors.length];
  }

  // ─── Private primitive read helpers ──────────────────────────────────────

  private readNumber(record: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  private readKpiNumber(kpis: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
      const raw = kpis[key];
      const direct = this.toMaybeNumber(raw);
      if (direct !== null) return direct;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const nested = this.readNumber(raw as Record<string, unknown>, ['value', 'current', 'currentValue', 'actual', 'total', 'count']);
        if (nested > 0) return nested;
      }
    }
    return 0;
  }
}
