import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as echarts from 'echarts';

import {
  AnalyticsDashboardDto,
  AnalyticsDashboardParams,
  AnalyticsFiltersDto,
  AnalyticsMonthlyHoursDto,
  AnalyticsMonthlyKpiDto,
} from '../../models/analytics-dashboard.models';
import { AnalyticsDashboardService } from '../../services/analytics-dashboard.service';
import { SharedModule } from '../../../../shared/shared.module';

type AnalyticsTab = 'overview' | 'kpis' | 'hours';
import { MetricTone, DashboardMetric } from '../../models/dashboard-metric.model';
type PeriodFilterMode = 'ytd' | 'month';

interface AnalyticsMetric extends DashboardMetric {
  change?: string;
  isUp?: boolean;
  sparklinePath?: string;
  sparklineAreaPath?: string;
}

interface KpiChartConfig {
  key: 'effectiveness' | 'otd' | 'csat';
  title: string;
  subtitle: string;
  icon: string;
  tone: MetricTone;
}

interface HourCategoryConfig {
  key: keyof AnalyticsMonthlyHoursDto;
  label: string;
  color: string;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SharedModule],
  templateUrl: './analytics-dashboard.html',
  styleUrls: ['./analytics-dashboard.scss'],
})
export class AnalyticsDashboard implements OnInit {
  private readonly analyticsService = inject(AnalyticsDashboardService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly now = new Date();
  private readonly platformId = inject(PLATFORM_ID);
  private utilizationChart: echarts.ECharts | null = null;
  private trendChart: echarts.ECharts | null = null;
  private hoursBreakdownChart: echarts.ECharts | null = null;
  private buHoursChart: echarts.ECharts | null = null;
  private kpiChartsInstances: echarts.ECharts[] = [];
  private resizeObservers: ResizeObserver[] = [];

  @ViewChild('utilizationEchart') utilizationEchartContainer!: ElementRef;
  @ViewChild('trendEchart') trendEchartContainer!: ElementRef;
  @ViewChild('hoursBreakdownEchart') hoursBreakdownEchartContainer!: ElementRef;
  @ViewChild('buHoursEchart') buHoursEchartContainer!: ElementRef;
  @ViewChildren('kpiEchart') kpiEchartContainers!: QueryList<ElementRef>;

  readonly tabs: Array<{ id: AnalyticsTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'kpis', label: 'KPI Quality', icon: 'query_stats' },
    { id: 'hours', label: 'Hours Allocation', icon: 'stacked_bar_chart' },
  ];

  readonly kpiCharts: KpiChartConfig[] = [
    {
      key: 'effectiveness',
      title: 'Effectiveness',
      subtitle: 'Monthly average effectiveness percentage',
      icon: 'verified',
      tone: 'green',
    },
    {
      key: 'otd',
      title: 'On-Time Delivery',
      subtitle: 'Monthly average OTD percentage',
      icon: 'schedule',
      tone: 'blue',
    },
    {
      key: 'csat',
      title: 'Customer Satisfaction',
      subtitle: 'Monthly average CSAT percentage',
      icon: 'star',
      tone: 'orange',
    },
  ];

  readonly hourCategories: HourCategoryConfig[] = [
    { key: 'executionHours', label: 'Execution', color: '#2563eb' }, // Deep Blue
    { key: 'technicalSupervisionHours', label: 'Tech Lead', color: '#7c3aed' }, // Purple
    { key: 'processHours', label: 'Process', color: '#10b981' }, // Success Green
    { key: 'projectManagementHours', label: 'PM', color: '#eb8708' }, // Brand Orange
    { key: 'researchAndDevHours', label: 'R&D', color: '#06b6d4' }, // Cyan
    { key: 'workshopHours', label: 'Workshop', color: '#ec4899' }, // Pink
    { key: 'otherHours', label: 'Other', color: '#64748b' }, // Slate
    { key: 'internManagementHours', label: 'Intern', color: '#14b8a6' }, // Teal Accent
  ];

  activeTab: AnalyticsTab = 'overview';
  filters: AnalyticsFiltersDto = this.emptyFilters();
  dashboard: AnalyticsDashboardDto | null = null;
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  private latestDashboardRequest = 0;

  periodFilterMode: PeriodFilterMode = 'ytd';
  selectedMonth: number | null = null;
  selectedYear: number | null = null;
  selectedUserId: string | null = null;
  selectedProjectId: string | null = null;
  selectedDepartmentId: string | null = null;
  selectedBusinessUnitId: string | null = null;
  selectedPlantId: string | null = null;
  private isDefaultFilter = true;

  ngOnInit(): void {
    this.periodFilterMode = 'ytd';
    this.selectedMonth = null;
    this.selectedYear = this.currentFiscalYear();
    this.isDefaultFilter = true;
    
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', this.resizeCharts.bind(this));
      if (this.dashboard) {
        setTimeout(() => this.updateCharts(), 200);
      }
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeCharts.bind(this));
    }
    this.resizeObservers.forEach(o => o.disconnect());
    this.resizeObservers = [];
    if (this.utilizationChart) {
      this.utilizationChart.dispose();
    }
    if (this.trendChart) {
      this.trendChart.dispose();
    }
    if (this.hoursBreakdownChart) {
      this.hoursBreakdownChart.dispose();
    }
    if (this.buHoursChart) {
      this.buHoursChart.dispose();
    }
    this.kpiChartsInstances.forEach(c => c.dispose());
  }

  private resizeCharts(): void {
    if (this.utilizationChart) this.utilizationChart.resize();
    if (this.trendChart) this.trendChart.resize();
    if (this.hoursBreakdownChart) this.hoursBreakdownChart.resize();
    if (this.buHoursChart) this.buHoursChart.resize();
    this.kpiChartsInstances.forEach(c => c.resize());
  }

  get metrics(): AnalyticsMetric[] {
    const summary = this.dashboard?.summary;
    const kpiTrend = this.dashboard?.kpis?.monthlyTrend ?? [];
    const utilTrend = this.dashboard?.hours?.utilizationTrend ?? [];

    const getKpiPoints = (key: 'effectiveness' | 'otd' | 'csat') => 
      kpiTrend.map(t => Number(t[key] || 0));

    const getTrendInfo = (points: number[]) => {
      if (points.length < 2) return { change: '0%', isUp: true };
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      const diff = last - prev;
      return {
        change: `${Math.abs(Math.round(diff * 100)) / 100}%`,
        isUp: diff >= 0
      };
    };

    const makeMetric = (label: string, value: string, note: string, icon: string, tone: MetricTone, points: number[], actionLabel = 'Open trend'): AnalyticsMetric => {
      const trend = getTrendInfo(points);
      const spark = this.generateSparkline(points);
      return { label, value, note, icon, tone, actionLabel, ...trend, ...spark };
    };

    return [
      makeMetric('Effectiveness', this.formatPercent(summary?.averageEffectiveness), 'Portfolio average', 'verified', this.percentTone(summary?.averageEffectiveness), getKpiPoints('effectiveness'), 'Open KPI quality'),
      makeMetric('OTD', this.formatPercent(summary?.averageOtd), 'On-time delivery', 'schedule', this.percentTone(summary?.averageOtd), getKpiPoints('otd'), 'Open KPI quality'),
      makeMetric('CSAT', this.formatPercent(summary?.averageCsat), 'Customer satisfaction', 'star', this.percentTone(summary?.averageCsat), getKpiPoints('csat'), 'Open KPI quality'),
      makeMetric('Utilization', this.formatPercent(summary?.averageUtilization), 'Team capacity usage', 'speed', this.percentTone(summary?.averageUtilization), utilTrend.map(t => t.utilizationPercentage || 0), 'Open utilization'),
      {
        label: 'Total Hours',
        value: this.formatNumber(summary?.totalHours),
        note: `${this.formatNumber(summary?.ytdHours)}h YTD in fiscal year`,
        icon: 'hourglass_empty',
        tone: 'purple',
        actionLabel: 'Open hours',
        ...getTrendInfo(this.dashboard?.hours?.monthlyByCategory?.map(h => Number(h.totalHours)) ?? []),
        ...this.generateSparkline(this.dashboard?.hours?.monthlyByCategory?.map(h => Number(h.totalHours)) ?? [])
      },
      {
        label: 'Active Members',
        value: this.formatNumber(summary?.activeTeamMembers),
        note: 'People with activity',
        icon: 'groups',
        tone: 'teal',
        actionLabel: 'Open utilization',
      },
    ];
  }

  private generateSparkline(points: number[]): { sparklinePath: string; sparklineAreaPath: string } {
    if (!points || points.length < 2) return { sparklinePath: '', sparklineAreaPath: '' };
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const width = 100;
    const height = 40;

    const path = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
    return { sparklinePath: path, sparklineAreaPath: areaPath };
  }

  get kpiTrend(): AnalyticsMonthlyKpiDto[] {
    return this.dashboard?.kpis?.monthlyTrend ?? [];
  }

  get monthlyHours(): AnalyticsMonthlyHoursDto[] {
    return this.dashboard?.hours?.monthlyByCategory ?? [];
  }

  hasKpiData(key: KpiChartConfig['key']): boolean {
    return (this.dashboard?.kpis?.monthlyTrend ?? []).some(t => Number(t[key] || 0) > 0);
  }

  hasHoursData(): boolean {
    return (this.dashboard?.hours?.monthlyByCategory ?? []).some(h => Number(h.totalHours || 0) > 0);
  }

  hasUtilizationData(): boolean {
    return (this.dashboard?.hours?.utilizationTrend ?? []).some(u => Number(u.utilizationPercentage || 0) > 0);
  }

  hasBuData(): boolean {
    return (this.dashboard?.hours?.byBusinessUnit ?? []).length > 0;
  }

  get maxMonthlyHours(): number {
    return Math.max(1, ...this.monthlyHours.map((item) => Number(item.totalHours || 0)));
  }

  get utilizationTrend() {
    return this.dashboard?.hours?.utilizationTrend ?? [];
  }

  get ytdYearOptions(): number[] {
    const currentFiscalYear = this.currentFiscalYear();
    const years = new Set<number>();

    for (let year = currentFiscalYear; year >= 2020; year--) {
      years.add(year);
    }

    (this.filters.fiscalYears ?? []).forEach((year) => {
      if (Number.isFinite(Number(year))) {
        years.add(Number(year));
      }
    });

    const period = this.dashboard?.period;
    if (period?.fiscalYear) years.add(period.fiscalYear);
    if (period?.year) years.add(period.year);

    this.kpiTrend.forEach((item) => {
      if (item.year) years.add(this.fiscalYearForDateParts(item.year, item.month));
    });
    this.monthlyHours.forEach((item) => {
      if (item.year) years.add(this.fiscalYearForDateParts(item.year, item.month));
    });
    this.utilizationTrend.forEach((item) => {
      if (item.year) years.add(this.fiscalYearForDateParts(item.year, item.month));
    });

    return Array.from(years).sort((a, b) => b - a);
  }

  get fiscalMonthOptions(): Array<{ value: number; label: string }> {
    const months = this.filters.months?.length ? this.filters.months : this.defaultMonths();
    return [...months].sort((a, b) => this.fiscalMonthIndex(a.value) - this.fiscalMonthIndex(b.value));
  }

  get utilizationPoints(): string {
    const trend = this.dashboard?.hours?.utilizationTrend ?? [];
    if (!trend.length) return '';

    return trend
      .map((item, index) => {
        const x = this.chartX(index, trend.length);
        const y = this.percentY(item.utilizationPercentage, 120);
        return `${x},${y}`;
      })
      .join(' ');
  }

  get selectedPeriodLabel(): string {
    const period = this.dashboard?.period;
    if (!period) {
      return this.periodFilterMode === 'ytd' ? 'All Time YTD' : 'Current Month';
    }

    if (this.periodFilterMode === 'ytd') {
      if (!period.fiscalYear && !this.selectedYear) {
        return 'All Time';
      }
      const fy = period.fiscalYear || this.selectedYear;
      return `${fy || 'All Time'}`;
    }

    return `${period.monthName} ${period.year}`;
  }

  get fiscalYearLabel(): string {
    const period = this.dashboard?.period;
    if (!period) {
      return this.selectedYear ? `FY${this.selectedYear}` : 'Cumulative Performance';
    }

    if (!period.fiscalYear && !this.selectedYear) {
      return `Portfolio Lifecycle (${this.shortDate(period.startDate)} - ${this.shortDate(period.endDate)})`;
    }

    const fy = period.fiscalYear || this.selectedYear;
    return `FY${fy} (${this.shortDate(period.fiscalYearStartDate)} - ${this.shortDate(period.fiscalYearEndDate)})`;
  }

  setTab(tab: AnalyticsTab): void {
    this.activeTab = tab;
    this.disposeCharts();
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.updateCharts();
        this.cdr.markForCheck();
      }, 150);
    }
  }

  openMetricTarget(metric: AnalyticsMetric): void {
    const label = metric.label.toLowerCase();
    this.setTab(label === 'effectiveness' || label === 'otd' || label === 'csat' ? 'kpis' : 'hours');
  }

  private disposeCharts(): void {
    if (this.utilizationChart) {
      this.utilizationChart.dispose();
      this.utilizationChart = null;
    }
    if (this.trendChart) {
      this.trendChart.dispose();
      this.trendChart = null;
    }
    if (this.hoursBreakdownChart) {
      this.hoursBreakdownChart.dispose();
      this.hoursBreakdownChart = null;
    }
    if (this.buHoursChart) {
      this.buHoursChart.dispose();
      this.buHoursChart = null;
    }
    this.kpiChartsInstances.forEach(c => {
      if (c && !c.isDisposed()) c.dispose();
    });
    this.kpiChartsInstances = [];
  }

  applyFilters(): void {
    this.loadDashboard(false);
  }

  onPeriodModeChanged(mode: PeriodFilterMode): void {
    if (this.isLoading) return;
    this.clearDefaultIfActive();
    this.periodFilterMode = mode;

    if (this.periodFilterMode === 'ytd') {
      this.selectedMonth = null;
      this.selectedYear = this.selectedYear ?? this.currentFiscalYear();
    }

    if (this.periodFilterMode === 'month') {
      this.selectedMonth = this.selectedMonth ?? this.now.getMonth() + 1;
      this.selectedYear = this.selectedYear ?? this.currentFiscalYear();
    }

    this.reloadFromSelection();
  }
  onYtdYearChanged(year: number | null): void {
    if (this.isLoading) return;
    this.clearDefaultIfActive();
    this.selectedYear = year;
    this.reloadFromSelection();
  }

  onMonthChanged(month: number | null): void {
    if (this.isLoading) return;
    this.clearDefaultIfActive();
    this.selectedMonth = month;
    this.periodFilterMode = 'month';
    this.reloadFromSelection();
  }

  onScopeFilterChanged(field: 'user' | 'project' | 'department' | 'businessUnit', value: string | null): void {
    if (this.isLoading) return;
    this.clearDefaultIfActive();
    switch (field) {
      case 'user':
        this.selectedUserId = value;
        break;
      case 'project':
        this.selectedProjectId = value;
        break;
      case 'department':
        this.selectedDepartmentId = value;
        break;
      case 'businessUnit':
        this.selectedBusinessUnitId = value;
        break;
    }

    this.reloadFromSelection();
  }

  private reloadFromSelection(): void {
    if (this.isLoading) {
      return;
    }

    this.loadDashboard(false);
  }

  private clearDefaultIfActive(): void {
    if (this.isDefaultFilter) {
      this.isDefaultFilter = false;
    }
  }

  resetFilters(): void {
    this.periodFilterMode = 'ytd';
    this.selectedMonth = null;
    this.selectedYear = this.currentFiscalYear();
    this.isDefaultFilter = true;
    
    this.selectedUserId = null;
    this.selectedProjectId = null;
    this.selectedDepartmentId = null;
    this.selectedBusinessUnitId = null;
    this.selectedPlantId = null;
    this.loadDashboard(false);
  }

  trackByMonth(_: number, item: { year: number; month: number }): string {
    return `${item.year}-${item.month}`;
  }

  kpiValue(item: AnalyticsMonthlyKpiDto, key: KpiChartConfig['key']): number {
    return Number(item[key] || 0);
  }

  barHeight(percent: number, max = 100): number {
    return Math.max(0, Math.min(168, (Number(percent || 0) / max) * 168));
  }

  barY(percent: number, max = 100): number {
    return 184 - this.barHeight(percent, max);
  }

  stackedSegmentHeight(item: AnalyticsMonthlyHoursDto, category: HourCategoryConfig): number {
    return (Number(item[category.key] || 0) / this.maxMonthlyHours) * 180;
  }

  stackedSegmentPercent(item: AnalyticsMonthlyHoursDto, category: HourCategoryConfig): number {
    const total = Number(item.totalHours || 0);
    if (total <= 0) return 0;

    return Math.max(0, (Number(item[category.key] || 0) / total) * 100);
  }

  totalHoursPercent(item: AnalyticsMonthlyHoursDto): number {
    return Math.max(0, Math.min(100, (Number(item.totalHours || 0) / this.maxMonthlyHours) * 100));
  }

  utilizationHeight(value: number): number {
    return Math.max(0, Math.min(100, (Number(value || 0) / 120) * 100));
  }

  utilizationWidth(value: number): number {
    return Math.max(0, Math.min(100, Number(value || 0)));
  }

  stackedSegmentY(item: AnalyticsMonthlyHoursDto, categoryIndex: number): number {
    const prior = this.hourCategories
      .slice(0, categoryIndex)
      .reduce((total, category) => total + this.stackedSegmentHeight(item, category), 0);

    return 190 - prior - this.stackedSegmentHeight(item, this.hourCategories[categoryIndex]);
  }

  chartX(index: number, total: number): number {
    if (total <= 1) return 42;
    return 42 + (index * 516) / (total - 1);
  }

  percentY(value: number, max = 100): number {
    return 190 - Math.max(0, Math.min(180, (Number(value || 0) / max) * 180));
  }

  fiscalYearOptionLabel(year: number): string {
    return `${year}`;
  }

  getToneColor(tone: MetricTone): string {
    const map: Partial<Record<MetricTone, string>> = {
      blue: '#2563eb',
      green: '#12b76a',
      orange: '#f97316',
      red: '#f04438',
      purple: '#7c3aed',
      teal: '#14b8a6'
    };
    return map[tone] || '#64748b';
  }

  formatPercent(value: unknown): string {
    const num = Number(value ?? 0);
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(num / 100);
  }

  formatNumber(value: unknown): string {
    const num = Number(value ?? 0);
    return new Intl.NumberFormat('en-US').format(num);
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.analyticsService
      .getFilters()
      .pipe(catchError(() => of(this.emptyFilters())))
      .subscribe((filters) => {
        this.filters = this.normalizeFilters(filters);
        this.cdr.markForCheck();
      });

    this.analyticsService
      .getDashboard(this.buildParams())
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => this.updateCharts(), 200);
        }
      }))
      .subscribe({
        next: (dashboard) => {
          this.dashboard = dashboard;
          this.syncSelectionFromDashboard(dashboard);
        },
        error: () => {
          this.dashboard = null;
          this.errorMessage = 'Unable to load analytics right now.';
        },
      });
  }

  loadDashboard(initial: boolean = false): void {
    const requestId = ++this.latestDashboardRequest;
    this.isRefreshing = !initial;
    this.errorMessage = '';

    this.analyticsService
      .getDashboard(this.buildParams())
      .pipe(finalize(() => {
        if (requestId === this.latestDashboardRequest) {
          this.isRefreshing = false;
          this.cdr.markForCheck();
          if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => this.updateCharts(), 100);
          }
        }
      }))
      .subscribe({
        next: (dashboard) => {
          if (requestId !== this.latestDashboardRequest) {
            return;
          }

          this.dashboard = dashboard;
          this.syncSelectionFromDashboard(dashboard);
        },
        error: () => {
          if (requestId !== this.latestDashboardRequest) {
            return;
          }

          this.errorMessage = 'Unable to refresh analytics with the selected filters.';
        },
      });
  }

  private updateCharts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.updateUtilizationChart();
    this.updateTrendChart();
    this.updateKpiCharts();
    this.updateHoursBreakdownChart();
    this.updateBuHoursChart();
  }

  private updateUtilizationChart(): void {
    if (!this.utilizationEchartContainer) return;

    if (!this.utilizationChart) {
      this.utilizationChart = echarts.init(this.utilizationEchartContainer.nativeElement);
      this.setupResizeObserver(this.utilizationEchartContainer.nativeElement, this.utilizationChart);
    }

    const totalLoggedHours = this.dashboard?.summary?.totalHours || 1;
    const hoursTrend = this.dashboard?.hours?.monthlyByCategory ?? [];
    const categories = this.hourCategories.map(cat => {
      const total = hoursTrend.reduce((sum, item) => sum + (Number(item[cat.key]) || 0), 0);
      return {
        name: cat.label,
        value: total
      };
    }).filter(c => c.value > 0);

    if (categories.length === 0) {
      if (this.utilizationChart) this.utilizationChart.clear();
    } else {
      const option: echarts.EChartsOption = {
        tooltip: { 
          trigger: 'item',
          formatter: '{b}: <strong>{c}h</strong> ({d}%)'
        },
        legend: { 
          bottom: '5%',
          left: 'center',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { 
            color: '#1e293b', 
            fontWeight: 800,
            fontSize: 12
          }
        },
        series: [
          {
            name: 'Effort',
            type: 'pie',
            radius: ['40%', '65%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 20,
                fontWeight: 'bold'
              }
            },
            labelLine: {
              show: false
            },
            data: categories
          }
        ]
      };
      this.utilizationChart.setOption(option);
    }
  }

  private updateKpiCharts(): void {
    if (!isPlatformBrowser(this.platformId) || !this.kpiEchartContainers) return;

    const containers = this.kpiEchartContainers.toArray();
    const trend = this.dashboard?.kpis?.monthlyTrend ?? [];
    const fiscalMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const monthNames = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

    this.kpiCharts.forEach((config, index) => {
      const container = containers[index];
      if (!container) return;

      let chart = this.kpiChartsInstances[index];
      if (!chart) {
        chart = echarts.init(container.nativeElement);
        this.kpiChartsInstances[index] = chart;
        this.setupResizeObserver(container.nativeElement, chart);
      }

      const mappedData = fiscalMonths.map(m => {
        const match = trend.find(t => Number(t.month) === m);
        return match ? Number(match[config.key] || 0) : 0;
      });

      const toneColor = this.getToneColor(config.tone);

      const option: echarts.EChartsOption = {
        grid: { top: 20, right: 10, bottom: 30, left: 45 },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const p = params[0];
            return `<div style="font-weight:800; color:#1e293b;">${p.name}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${toneColor};"></span>
                      <strong style="color:${toneColor}; font-size:1.1rem;">${p.value}%</strong>
                    </div>`;
          }
        },
        xAxis: {
          type: 'category',
          data: monthNames,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 700 }
        },
        yAxis: {
          type: 'value',
          max: 100,
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 700, formatter: '{value}%' }
        },
        series: [{
          name: config.title,
          type: 'line',
          data: mappedData.map(v => v === 0 ? null : v),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: toneColor, width: 3 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: toneColor + '44' },
              { offset: 1, color: toneColor + '00' }
            ])
          },
          connectNulls: false
        }]
      };

      chart.setOption(option);
    });
  }

  private updateTrendChart(): void {
    if (!isPlatformBrowser(this.platformId) || !this.trendEchartContainer) return;

    if (!this.trendChart) {
      this.trendChart = echarts.init(this.trendEchartContainer.nativeElement);
      this.setupResizeObserver(this.trendEchartContainer.nativeElement, this.trendChart);
    }

    const fiscalMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const trend = this.dashboard?.hours?.utilizationTrend ?? [];
    
    const monthNames = [
      'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 
      'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'
    ];

    const mappedData = fiscalMonths.map(m => {
      const match = trend.find(t => Number(t.month) === m);
      return match ? match.utilizationPercentage : 0;
    });

    const option: echarts.EChartsOption = {
      grid: { top: 60, right: 30, bottom: 60, left: 60 },
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          let res = `<div style="font-weight: 800; margin-bottom: 4px;">${params[0].name}</div>`;
          params.forEach((p: any) => {
            res += `<div style="display:flex; align-items:center; gap:8px;">
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${p.color};"></span>
              <span style="color:#64748b; font-weight:600;">${p.seriesName}:</span>
              <strong style="margin-left:auto;">${p.value}%</strong>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        top: 10,
        right: 'center',
        textStyle: { color: '#64748b', fontWeight: 700 }
      },
      xAxis: {
        type: 'category',
        data: monthNames,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontWeight: 700, fontSize: 11, margin: 15 }
      },
      yAxis: {
        type: 'value',
        max: 120,
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { formatter: '{value}%', color: '#64748b', fontWeight: 700 }
      },
      series: [
        {
          name: 'Monthly Utilization',
          type: 'bar',
          data: mappedData,
          itemStyle: {
            color: (params: any) => {
              const val = params.data;
              if (val === 0) return 'transparent';
              if (val >= 85) return '#10b981';
              if (val >= 65) return '#f59e0b';
              return '#ef4444';
            },
            borderRadius: [6, 6, 0, 0]
          },
          barWidth: '40%'
        },
        {
          name: 'Trend Line',
          type: 'line',
          data: mappedData.map(v => v === 0 ? null : v),
          smooth: true,
          lineStyle: { color: '#1e293b', width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#1e293b', borderWidth: 2, borderColor: '#fff' },
          connectNulls: false
        }
      ]
    };

    this.trendChart.setOption(option);
  }

  private buildParams(): AnalyticsDashboardParams {
    const month = this.periodFilterMode === 'month' ? this.selectedMonth : null;
    const year = this.requestYear();

    return {
      month,
      year,
      fiscalYear: this.periodFilterMode === 'ytd' ? this.selectedYear : null,
      periodMode: this.periodFilterMode,
      quickSelect: this.periodFilterMode === 'ytd' ? 'YTD' : this.periodFilterMode,
      userId: this.selectedUserId,
      projectId: this.selectedProjectId,
      departmentId: this.selectedDepartmentId,
      businessUnitId: this.selectedBusinessUnitId,
      plantId: this.selectedPlantId,
    };
  }

  private normalizeFilters(filters: AnalyticsFiltersDto): AnalyticsFiltersDto {
    const fiscalYears = filters.fiscalYears?.length
      ? filters.fiscalYears
      : [this.currentFiscalYear(), this.currentFiscalYear() - 1, this.currentFiscalYear() - 2];

    return {
      fiscalYears,
      months: filters.months?.length ? filters.months : this.defaultMonths(),
      users: filters.users ?? [],
      projects: filters.projects ?? [],
      departments: filters.departments ?? [],
      businessUnits: filters.businessUnits ?? [],
      plants: filters.plants ?? [],
    };
  }

  private emptyFilters(): AnalyticsFiltersDto {
    return {
      fiscalYears: [],
      months: this.defaultMonths(),
      users: [],
      projects: [],
      departments: [],
      businessUnits: [],
      plants: [],
    };
  }

  private defaultMonths(): Array<{ value: number; label: string }> {
    return Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)),
    }));
  }

  private percentTone(value: unknown): MetricTone {
    const parsed = Number(value ?? 0);
    if (parsed >= 85) return 'green';
    if (parsed >= 65) return 'orange';
    return 'red';
  }

  private updateHoursBreakdownChart(): void {
    if (!this.hoursBreakdownEchartContainer) return;

    if (!this.hoursBreakdownChart) {
      this.hoursBreakdownChart = echarts.init(this.hoursBreakdownEchartContainer.nativeElement);
      this.setupResizeObserver(this.hoursBreakdownEchartContainer.nativeElement, this.hoursBreakdownChart);
    }

    const rawData = this.dashboard?.hours?.monthlyByCategory ?? [];
    const fiscalMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const monthNames = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'];

    // Map data to the full fiscal year
    const seriesData = this.hourCategories.map(cat => ({
      name: cat.label,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: fiscalMonths.map(m => {
        const match = rawData.find(d => Number(d.month) === m);
        return match ? Number(match[cat.key]) || 0 : 0;
      }),
      itemStyle: { color: cat.color },
      barWidth: '55%'
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#1e293b' },
        formatter: (params: any) => {
          let res = `<div style="font-weight: 800; color: #1e293b; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">${params[0].name}</div>`;
          let total = 0;
          params.forEach((p: any) => {
            if (p.value > 0) {
              res += `<div style="display: flex; justify-content: space-between; gap: 30px; margin-bottom: 3px;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>
                  <span style="color: #64748b; font-weight: 600;">${p.seriesName}</span>
                </span>
                <strong style="color: #1e293b;">${this.formatNumber(p.value)}h</strong>
              </div>`;
              total += p.value;
            }
          });
          if (total > 0) {
            res += `<div style="border-top: 2px solid #f1f5f9; margin-top: 8px; padding-top: 8px; font-weight: 800; display: flex; justify-content: space-between; color: #1e293b;">
              <span>Total Hours</span>
              <span>${this.formatNumber(total)}h</span>
            </div>`;
          } else {
            return `<div style="color: #94a3b8; font-style: italic; padding: 10px;">No hours recorded for this month</div>`;
          }
          return res;
        }
      },
      legend: {
        bottom: 10,
        left: 'center',
        itemGap: 25,
        itemWidth: 12,
        itemHeight: 12,
        padding: [10, 0, 10, 0],
        textStyle: { 
          color: '#1e293b', 
          fontWeight: 800, 
          fontSize: 12,
          padding: [0, 0, 0, 4]
        }
      },
      grid: {
        top: '8%',
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: monthNames,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { 
          color: '#64748b', 
          fontWeight: 700,
          fontSize: 11,
          interval: 0,
          rotate: monthNames.length > 8 ? 35 : 0
        }
      },
      yAxis: {
        type: 'value',
        name: 'Hours Logged',
        nameTextStyle: {
          color: '#94a3b8',
          fontWeight: 800,
          fontSize: 10,
          padding: [0, 0, 10, 0]
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { 
          color: '#64748b', 
          fontWeight: 700,
          fontSize: 11
        }
      },
      series: seriesData as any
    };

    this.hoursBreakdownChart.setOption(option);
  }

  private updateBuHoursChart(): void {
    if (!this.buHoursEchartContainer) return;

    if (!this.buHoursChart) {
      this.buHoursChart = echarts.init(this.buHoursEchartContainer.nativeElement);
      this.setupResizeObserver(this.buHoursEchartContainer.nativeElement, this.buHoursChart);
    }

    const data = this.dashboard?.hours?.byBusinessUnit ?? [];
    if (data.length === 0) {
      this.buHoursChart.clear();
      return;
    }

    const buColors = [
      '#6366f1', // Indigo
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f59e0b', // Amber
      '#8b5cf6', // Violet
      '#f43f5e', // Rose
      '#06b6d4', // Cyan
      '#84cc16'  // Lime
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#1e293b' },
        formatter: (params: any) => {
          return `
            <div style="padding: 4px;">
              <div style="font-weight: 800; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9;">${params.name}</div>
              <div style="display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #64748b; font-weight: 600;">Total Hours</span>
                <strong style="color: #1e293b;">${this.formatNumber(params.value)}h</strong>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 20px; margin-top: 4px;">
                <span style="color: #64748b; font-weight: 600;">Share</span>
                <strong style="color: #2563eb;">${params.percent}%</strong>
              </div>
            </div>`;
        }
      },
      legend: {
        bottom: '5%',
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 15,
        textStyle: { 
          color: '#1e293b', 
          fontWeight: 800,
          fontSize: 11
        }
      },
      color: buColors,
      series: [
        {
          name: 'Business Units',
          type: 'pie',
          radius: [30, 140],
          center: ['50%', '42%'],
          roseType: 'area',
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              formatter: '{b}\n{d}%'
            }
          },
          data: data.map(item => ({
            name: item.label || 'N/A',
            value: item.hours
          }))
        }
      ]
    };

    this.buHoursChart.setOption(option);
  }

  private currentFiscalYear(): number {
    const year = this.now.getFullYear();
    const month = this.now.getMonth() + 1;

    return month >= 10 ? year + 1 : year;
  }

  private fiscalYearForDateParts(year: number, month: number): number {
    return Number(month || 0) >= 10 ? year + 1 : year;
  }

  private syncSelectionFromDashboard(dashboard: AnalyticsDashboardDto | null): void {
    const period = dashboard?.period;
    if (!period) return;

    if (this.selectedYear !== null) {
      this.selectedYear = period.fiscalYear || period.year || this.selectedYear;
    }
    
    if (this.periodFilterMode === 'month') {
      this.selectedMonth = period.month || this.selectedMonth;
    }
  }

  private fiscalMonthIndex(month: number): number {
    return month >= 10 ? month - 10 : month + 2;
  }

  private requestYear(): number | null {
    return this.periodFilterMode === 'month' ? this.selectedYear : null;
  }

  private shortDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private setupResizeObserver(element: HTMLElement, chart: echarts.ECharts): void {
    if (typeof ResizeObserver !== 'undefined' && element) {
      const observer = new ResizeObserver(() => {
        if (chart && !chart.isDisposed()) {
          chart.resize();
        }
      });
      observer.observe(element);
      this.resizeObservers.push(observer);
    }
  }
}
