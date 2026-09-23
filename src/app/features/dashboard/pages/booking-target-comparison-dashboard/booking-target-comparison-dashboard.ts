import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { catchError, finalize, of } from 'rxjs';
import * as echarts from 'echarts';

import { AnalyticsDashboardService } from '../../services/analytics-dashboard.service';
import { SharedModule } from '../../../../shared/shared.module';
import {
  BookingTargetComparisonDto,
  BookingTargetComparisonQuery,
  BookingMonthlyTrendPoint,
  BookingPopulationDto,
  CalculationMode,
} from '../../models/booking-target-comparison.model';

type ViewMetric = 'hours' | 'revenue';
type ChartView = 'monthly' | 'cumulative';

interface PopulationRow {
  label: string;
  icon: string;
  color: string;
  headcount: number;
  bookedHours: number;
  targetHours: number;
  remainingHours: number;
  hoursAchievementPercent: number;
  grossBookedHours: number;
  netBookedHours: number;
  bookedRevenue: number;
  targetRevenue: number;
  revenueAchievementPercent: number;
}

@Component({
  selector: 'app-booking-target-comparison-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SharedModule],
  templateUrl: './booking-target-comparison-dashboard.html',
  styleUrls: ['./booking-target-comparison-dashboard.scss'],
})
export class BookingTargetComparisonDashboard implements OnInit, OnDestroy {
  protected readonly Math = Math;

  private readonly analyticsService = inject(AnalyticsDashboardService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('trendChart') trendChartEl!: ElementRef<HTMLDivElement>;
  @ViewChild('barChart') barChartEl!: ElementRef<HTMLDivElement>;

  private trendChartInstance: echarts.ECharts | null = null;
  private barChartInstance: echarts.ECharts | null = null;
  private resizeHandler = () => this.resizeCharts();

  // ─── State ─────────────────────────────────────────────────────────────────
  isLoading = false;
  errorMessage = '';
  data: BookingTargetComparisonDto | null = null;

  // ─── Filters ───────────────────────────────────────────────────────────────
  readonly now = new Date();
  calculationMode: CalculationMode = 'Net';
  periodMode: 'ytd' | 'fiscal_year' | 'month' = 'ytd';
  selectedFiscalYear: number = this.currentFiscalYear();
  selectedMonth: number = this.now.getMonth() + 1;
  hourlyRate = 27;
  targetHoursPerMember: number | null = null;

  // ─── UI toggles ────────────────────────────────────────────────────────────
  viewMetric: ViewMetric = 'hours';
  chartView: ChartView = 'cumulative';

  readonly fiscalYearOptions = Array.from({ length: 6 }, (_, i) => this.currentFiscalYear() - i);

  readonly monthOptions = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  // ─── Derived ───────────────────────────────────────────────────────────────

  get hasTrend(): boolean {
    return (this.data?.monthlyTrend ?? []).length > 0;
  }

  get populationRows(): PopulationRow[] {
    if (!this.data) return [];
    const s = this.data.summary;
    const isNet = this.calculationMode === 'Net';

    const toRow = (pop: BookingPopulationDto, icon: string, color: string): PopulationRow => {
      const bookedHours = isNet && pop.netBookedHours ? pop.netBookedHours : (pop.grossBookedHours || pop.bookedHours);
      const targetHours = pop.targetHours;
      const remainingHours = targetHours > 0 ? targetHours - bookedHours : pop.remainingHours;
      const hoursAchievementPercent = targetHours > 0 ? (bookedHours / targetHours) * 100 : pop.hoursAchievementPercent;

      return {
        label: pop.label || '',
        icon,
        color,
        headcount: pop.headcount,
        bookedHours,
        targetHours,
        remainingHours,
        hoursAchievementPercent,
        grossBookedHours: pop.grossBookedHours,
        netBookedHours: pop.netBookedHours,
        bookedRevenue: pop.bookedRevenue,
        targetRevenue: pop.targetRevenue,
        revenueAchievementPercent: pop.revenueAchievementPercent,
      };
    };

    return [
      toRow(s.employees, 'badge', '#2563eb'),
      toRow(s.subcontractors, 'handshake', '#7c3aed'),
      toRow(s.interns, 'school', '#0891b2'),
      toRow(s.total, 'people', '#059669'),
    ];
  }

  get totalRow(): PopulationRow | null {
    return this.populationRows[3] ?? null;
  }

  get periodLabel(): string {
    if (!this.data) return '';
    const start = this.data.startDate ? new Date(this.data.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    const end = this.data.endDate ? new Date(this.data.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    return start && end ? `${start} → ${end}` : '';
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.trendChartInstance?.dispose();
    this.barChartInstance?.dispose();
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const query: BookingTargetComparisonQuery = {
      periodMode: this.periodMode,
      calculationMode: this.calculationMode,
      fiscalYear: this.selectedFiscalYear,
      hourlyRate: this.hourlyRate,
    };

    if (this.periodMode === 'month') {
      query.month = this.selectedMonth;
      query.year = this.now.getFullYear();
    }

    if (this.targetHoursPerMember) {
      query.targetHoursPerMember = this.targetHoursPerMember;
    }

    this.analyticsService
      .getBookingTargetComparison(query)
      .pipe(
        catchError((err) => {
          this.errorMessage = err?.message ?? 'Unable to load data.';
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
          // Draw charts after view updates
          setTimeout(() => this.buildCharts(), 50);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.data = {
            ...result,
            calculationMode: this.calculationMode,
          };
        } else if (this.data) {
          this.data = {
            ...this.data,
            calculationMode: this.calculationMode,
          };
        }
      });
  }

  onModeChange(): void {
    if (this.data) {
      this.data = {
        ...this.data,
        calculationMode: this.calculationMode,
      };
      this.cdr.markForCheck();
      setTimeout(() => this.buildCharts(), 20);
    }
    this.loadData();
  }

  onChartViewChange(view: ChartView): void {
    this.chartView = view;
    this.buildCharts();
  }

  onMetricChange(metric: ViewMetric): void {
    this.viewMetric = metric;
    this.buildCharts();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  formatHours(h: number): string {
    return `${Math.round(h).toLocaleString('en-US')} h`;
  }

  formatEuro(v: number): string {
    return this.formatRevenue(v);
  }

  formatRevenue(v: number): string {
    return `$${Math.round(v).toLocaleString('en-US')}`;
  }

  formatPct(v: number): string {
    return `${Math.round(v)}%`;
  }

  achievementColor(pct: number): string {
    if (pct >= 90) return '#10b981';
    if (pct >= 70) return '#f59e0b';
    return '#ef4444';
  }

  trackByLabel(_: number, row: PopulationRow): string {
    return row.label;
  }

  private currentFiscalYear(): number {
    const d = new Date();
    // Fiscal year starts in October: if current month >= 10 → next year label
    return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  }

  // ─── ECharts ───────────────────────────────────────────────────────────────

  private resizeCharts(): void {
    this.trendChartInstance?.resize();
    this.barChartInstance?.resize();
  }

  private buildCharts(): void {
    if (!isPlatformBrowser(this.platformId) || !this.data) return;
    this.buildTrendChart();
    this.buildBarChart();
  }

  private buildTrendChart(): void {
    if (!this.trendChartEl?.nativeElement) return;
    const el = this.trendChartEl.nativeElement;

    if (this.trendChartInstance) {
      if (this.trendChartInstance.isDisposed() || this.trendChartInstance.getDom() !== el) {
        try {
          this.trendChartInstance.dispose();
        } catch {}
        this.trendChartInstance = null;
      }
    }

    if (!this.trendChartInstance) {
      const existing = echarts.getInstanceByDom(el);
      if (existing) {
        try {
          existing.dispose();
        } catch {}
      }
      this.trendChartInstance = echarts.init(el);
    }

    const trend = this.data!.monthlyTrend;
    const months = trend.map((t) => t.monthName);
    const isCumul = this.chartView === 'cumulative';
    const isHours = this.viewMetric === 'hours';
    const currentMode = this.calculationMode;

    let bookedSeries: number[];
    let targetSeries: number[];
    let grossSeries: number[];
    let netSeries: number[];
    let seriesUnit: string;
    let yAxisLabel: string;

    if (isHours) {
      bookedSeries = isCumul
        ? trend.map((t) => t.cumulativeBookedHours)
        : trend.map((t) => t.bookedHours);
      targetSeries = isCumul
        ? trend.map((t) => t.cumulativeTargetHours)
        : trend.map((t) => t.targetHours);
      grossSeries = isCumul
        ? trend.map((t) => t.cumulativeGrossBookedHours)
        : trend.map((t) => t.grossBookedHours);
      netSeries = isCumul
        ? trend.map((t) => t.cumulativeNetBookedHours)
        : trend.map((t) => t.netBookedHours);
      seriesUnit = 'h';
      yAxisLabel = 'Hours';
    } else {
      bookedSeries = isCumul
        ? trend.map((t) => t.cumulativeBookedRevenue)
        : trend.map((t) => t.bookedRevenue);
      targetSeries = isCumul
        ? trend.map((t) => t.cumulativeTargetRevenue)
        : trend.map((t) => t.targetRevenue);
      grossSeries = bookedSeries;
      netSeries = bookedSeries;
      seriesUnit = '$';
      yAxisLabel = 'Revenue ($)';
    }

    const showNetGross = isHours && currentMode === 'Net';

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 60, right: 24, top: 40, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          const lines = (params as any[]).map(
            (p: any) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>${seriesUnit === '$' ? '$' : ''}${Math.round(p.value).toLocaleString('en-US')}${seriesUnit !== '$' ? ' ' + seriesUnit : ''}</b>`,
          );
          return `<div style="font-family:sans-serif;font-size:13px"><b>${params[0]?.name}</b><br>${lines.join('<br>')}</div>`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v) },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        // Target line (dashed)
        {
          name: isCumul ? 'Cumulative Target' : 'Monthly Target',
          type: 'line',
          data: targetSeries,
          lineStyle: { color: '#94a3b8', width: 2, type: 'dashed' },
          itemStyle: { color: '#94a3b8' },
          symbol: 'none',
          areaStyle: undefined,
        },
        // Main booked line
        {
          name: currentMode === 'Net' ? 'Booked (Net)' : 'Booked (Gross)',
          type: 'line',
          data: currentMode === 'Net' ? netSeries : (grossSeries.some((v) => v > 0) ? grossSeries : bookedSeries),
          lineStyle: { color: '#2563eb', width: 3 },
          itemStyle: { color: '#2563eb' },
          symbol: 'circle',
          symbolSize: 5,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37,99,235,0.18)' },
              { offset: 1, color: 'rgba(37,99,235,0)' },
            ]),
          },
          smooth: true,
        },
        // Gross line (only shown for employees in Net mode)
        ...(showNetGross
          ? [
              {
                name: 'Booked (Gross)',
                type: 'line' as const,
                data: grossSeries,
                lineStyle: { color: '#7c3aed', width: 2, type: 'dotted' as const },
                itemStyle: { color: '#7c3aed' },
                symbol: 'none',
                smooth: true,
              },
            ]
          : []),
      ],
    };

    this.trendChartInstance.setOption(option, { notMerge: true });
    this.trendChartInstance.resize();
  }

  private buildBarChart(): void {
    if (!this.barChartEl?.nativeElement) return;
    const el = this.barChartEl.nativeElement;

    if (this.barChartInstance) {
      if (this.barChartInstance.isDisposed() || this.barChartInstance.getDom() !== el) {
        try {
          this.barChartInstance.dispose();
        } catch {}
        this.barChartInstance = null;
      }
    }

    if (!this.barChartInstance) {
      const existing = echarts.getInstanceByDom(el);
      if (existing) {
        try {
          existing.dispose();
        } catch {}
      }
      this.barChartInstance = echarts.init(el);
    }

    const populations = this.populationRows.slice(0, 3); // Employees, Subcontractors, Interns
    const isHours = this.viewMetric === 'hours';
    const labels = populations.map((p) => p.label);
    const booked = populations.map((p) => isHours ? p.bookedHours : p.bookedRevenue);
    const target = populations.map((p) => isHours ? p.targetHours : p.targetRevenue);
    const unit = isHours ? 'h' : '$';
    const colors = ['#2563eb', '#7c3aed', '#0891b2'];

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 80, right: 24, top: 30, bottom: 30 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const lines = (params as any[]).map(
            (p: any) => `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>${unit === '$' ? '$' : ''}${Math.round(p.value).toLocaleString('en-US')}${unit !== '$' ? ' ' + unit : ''}</b>`,
          );
          return `<div style="font-family:sans-serif;font-size:13px"><b>${params[0]?.name}</b><br>${lines.join('<br>')}</div>`;
        },
      },
      legend: { top: 5, textStyle: { fontSize: 12 } },
      xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#334155', fontSize: 12 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          name: 'Target',
          type: 'bar',
          data: target,
          barWidth: 14,
          itemStyle: { color: '#e2e8f0', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', formatter: (p: any) => `${unit === '$' ? '$' : ''}${Math.round(p.value).toLocaleString('en-US')}${unit !== '$' ? ' ' + unit : ''}`, color: '#94a3b8', fontSize: 11 },
        },
        {
          name: 'Booked',
          type: 'bar',
          data: booked,
          barWidth: 14,
          barGap: '30%',
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) => colors[params.dataIndex] ?? '#2563eb',
          },
          label: { show: true, position: 'right', formatter: (p: any) => `${unit === '$' ? '$' : ''}${Math.round(p.value).toLocaleString('en-US')}${unit !== '$' ? ' ' + unit : ''}`, color: '#334155', fontSize: 11 },
        },
      ],
    };

    this.barChartInstance.setOption(option, { notMerge: true });
    this.barChartInstance.resize();
  }
}
