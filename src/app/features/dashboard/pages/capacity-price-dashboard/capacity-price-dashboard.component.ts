import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { AnalyticsDashboardService } from '../../services/analytics-dashboard.service';
import { CapacityPriceDashboardDto, CapacityPriceQueryDto, InternCapacityPriceAnalyticsDto } from '../../../../core/models';
import { AnalyticsDashboardDto } from '../../models/analytics-dashboard.models';
import { AnalyticsDashboard } from '../analytics-dashboard/analytics-dashboard';
import { DashboardHome } from '../dashboard-home/dashboard-home';
import { BookingTargetComparisonDashboard } from '../booking-target-comparison-dashboard/booking-target-comparison-dashboard';
import { UsersApiService } from '../../../../core/services/users-api.service';
import { SharedModule } from '../../../../shared/shared.module';

export interface MonthlySynthesisItem {
  month: number;
  monthName: string;
  teEmployeesCount: number;
  teHours: number;
  subcontractorsCount: number;
  subcontractorHours: number;
  tEffectiveness: number;
  tah: number;
  targetHours: number;
  employeeSharePercentage: number;
  subcontractorSharePercentage: number;
  status: 'optimal' | 'warning' | 'neutral';
}

export type ManagementTab = 'dashboard' | 'overview' | 'portfolio' | 'capacity' | 'comparison' | (string & {});

@Component({
  selector: 'app-capacity-price-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    SharedModule,
    MatButtonToggleModule,
    AnalyticsDashboard,
    DashboardHome,
    BookingTargetComparisonDashboard
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './capacity-price-dashboard.component.html',
  styleUrls: ['./capacity-price-dashboard.component.scss']
})
export class CapacityPriceDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsDashboardService);
  private readonly usersApiService = inject(UsersApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  viewMode: 'team' | 'interns' = 'team';
  hasFilterChanges = false;
  
  dashboard: CapacityPriceDashboardDto | null = null;
  internDashboard: InternCapacityPriceAnalyticsDto | null = null;
  portfolioDashboard: AnalyticsDashboardDto | null = null;
  isManagementLoading = false;
  // Default to the capacity & price view for this dashboard
  managementTab: ManagementTab = 'capacity';

  isSynthesisModalOpen = false;
  synthesisSearchQuery = '';
  synthesisData: MonthlySynthesisItem[] = [];
  isLoadingSynthesis = false;
  isExportingSynthesis = false;
  totalYtdTah = 0;
  avgYtdEffectiveness = 0;
  totalTeCount = 0;
  totalSubcontractorCount = 0;
  
  query: CapacityPriceQueryDto = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    targetHoursPerMember: 171.9,
    targetHoursPerIntern: 172,
    hourlyRate: 27
  };
  
  readonly yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly monthOptions = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  @ViewChild('memberCapacitiesChart') memberCapacitiesContainer!: ElementRef;
  @ViewChild('capacityTargetChart') capacityTargetContainer!: ElementRef;
  @ViewChild('memberPricesChart') memberPricesContainer!: ElementRef;
  @ViewChild('priceTargetChart') priceTargetContainer!: ElementRef;

  private charts: echarts.ECharts[] = [];
  private resizeObservers: ResizeObserver[] = [];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['dashboard', 'overview', 'portfolio', 'capacity', 'comparison'].includes(params['tab'])) {
        this.managementTab = params['tab'] as ManagementTab;
      }
      let changed = false;
      if (params['month'] && !isNaN(+params['month'])) {
        this.query.month = +params['month'];
        changed = true;
      }
      if (params['year'] && !isNaN(+params['year'])) {
        this.query.year = +params['year'];
        changed = true;
      }
      
      this.loadDashboard();
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', this.resizeCharts.bind(this));
      if (this.dashboard || this.internDashboard) {
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
    this.charts.forEach(c => {
      if (!c.isDisposed()) {
        c.dispose();
      }
    });
    this.charts = [];
  }

  private resizeCharts(): void {
    this.charts.forEach(c => {
      if (c && !c.isDisposed()) {
        c.resize();
      }
    });
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

  onViewModeChange(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isRefreshing = true;
    this.errorMessage = '';
    this.loadSynthesisData();
    this.loadManagementOverview();
    
    forkJoin({
      team: this.analyticsService.getCapacityPriceDashboard(this.query),
      interns: this.analyticsService.getInternCapacityPriceDashboard(this.query),
    })
      .pipe(finalize(() => this.finalizeLoad()))
      .subscribe({
        next: ({ team, interns }) => {
          this.dashboard = team;
          this.internDashboard = interns;
        },
        error: (err) => this.handleError(err),
      });
  }

  /** Loads the portfolio KPIs independently so a management insight failure never hides capacity data. */
  private loadManagementOverview(): void {
    this.isManagementLoading = true;
    this.analyticsService.getDashboard({
      fiscalYear: this.query.year,
      periodMode: 'ytd',
    })
      .pipe(finalize(() => {
        this.isManagementLoading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (dashboard) => this.portfolioDashboard = dashboard,
        error: () => this.portfolioDashboard = null,
      });
  }

  setManagementTab(tab: ManagementTab): void {
    this.managementTab = tab;
    if (tab === 'capacity' && isPlatformBrowser(this.platformId)) {
      this.cdr.detectChanges();
      setTimeout(() => {
        this.updateCharts();
        this.resizeCharts();
      }, 50);
    }
  }

  private finalizeLoad(): void {
    this.isLoading = false;
    this.isRefreshing = false;
    this.cdr.markForCheck();
    if (isPlatformBrowser(this.platformId)) {
      this.cdr.detectChanges();
      setTimeout(() => {
        if (this.managementTab === 'capacity') {
          this.updateCharts();
        }
      }, 100);
    }
  }

  private handleError(err: any): void {
    this.errorMessage = err.message || 'Failed to load capacity price dashboard.';
    this.dashboard = null;
    this.internDashboard = null;
  }
  // onFilterChange moved up

  private updateCharts(): void {
    if (!this.dashboard && !this.internDashboard) return;
    this.resizeObservers.forEach(o => o.disconnect());
    this.resizeObservers = [];
    this.charts.forEach(c => {
      if (!c.isDisposed()) {
        c.dispose();
      }
    });
    this.charts = [];

    this.renderMemberCapacitiesChart();
    this.renderCapacityTargetChart();
    this.renderMemberPricesChart();
    this.renderPriceTargetChart();
  }

  get memberCapacitiesData() {
    if (this.viewMode === 'team') return this.dashboard?.memberCapacities || [];
    return this.internDashboard?.internDetails.map(d => ({
      userId: d.internId,
      userName: d.internName,
      bookedHours: d.bookedHours,
      percentage: d.progressionPercentage
    })) || [];
  }

  get memberPricesData() {
    if (this.viewMode === 'team') return this.dashboard?.memberPrices || [];
    return this.internDashboard?.internDetails.map(d => ({
      userId: d.internId,
      userName: d.internName,
      bookedPrice: d.bookedPrice,
      percentage: d.progressionPercentage
    })) || [];
  }

  get activeCapacityTarget() {
    return this.viewMode === 'team' ? this.dashboard?.capacityTarget : this.internDashboard?.capacityTarget;
  }

  get activePriceTarget() {
    return this.viewMode === 'team' ? this.dashboard?.priceTarget : this.internDashboard?.priceTarget;
  }

  get activeEmployeeCount(): number {
    return this.dashboard?.memberCounts?.employeeCount ?? this.dashboard?.memberCapacities.length ?? 0;
  }

  get activeMemberCountsDisplay(): string {
    const counts = this.dashboard?.memberCounts;
    if (!counts) return String(this.activeEmployeeCount);
    return `${counts.employeeCount} / ${counts.internCount} / ${counts.subcontractorCount}`;
  }

  get priceTargetAmount(): number {
    const data = this.activePriceTarget;
    if (!data) return 0;
    return data.targetPrice ?? ((data.bookedPrice || 0) + (data.remainingPrice || 0));
  }



  private readonly chartFont = 'Inter, system-ui, sans-serif';

  private formatFullNumber(number: number): string {
    return Intl.NumberFormat('en-US').format(Math.round(number));
  }

  private formatHours(number: number): string {
    return Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number);
  }

  setQuickDate(period: 'current' | 'previous'): void {
    const d = new Date();
    if (period === 'previous') {
      d.setMonth(d.getMonth() - 1);
    }
    this.query.month = d.getMonth() + 1;
    this.query.year = d.getFullYear();
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { month: this.query.month, year: this.query.year },
      queryParamsHandling: 'merge'
    });
  }

  markFilterChanged(): void {
    this.hasFilterChanges = true;
  }

  get isDefaultFilter(): boolean {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    return this.query.year === currentYear &&
           this.query.month === currentMonth &&
           this.query.targetHoursPerMember === 171.9 &&
           this.query.targetHoursPerIntern === 172 &&
           this.query.hourlyRate === 27;
  }

  applyFilters(): void {
    this.hasFilterChanges = false;
    
    const currentMonth = +(this.route.snapshot.queryParams['month'] || 0);
    const currentYear = +(this.route.snapshot.queryParams['year'] || 0);
    
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { month: this.query.month, year: this.query.year },
      queryParamsHandling: 'merge'
    });

    if ((this.query.month === currentMonth || !currentMonth) && (this.query.year === currentYear || !currentYear)) {
      this.loadDashboard();
    }
  }

  resetFilters(): void {
    this.query.year = new Date().getFullYear();
    this.query.month = new Date().getMonth() + 1;
    this.query.targetHoursPerMember = 171.9;
    this.query.targetHoursPerIntern = 172;
    this.query.hourlyRate = 27;
    this.hasFilterChanges = false;
    
    const currentMonth = +(this.route.snapshot.queryParams['month'] || 0);
    const currentYear = +(this.route.snapshot.queryParams['year'] || 0);
    
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { month: this.query.month, year: this.query.year },
      queryParamsHandling: 'merge'
    });

    if ((this.query.month === currentMonth || !currentMonth) && (this.query.year === currentYear || !currentYear)) {
      this.loadDashboard();
    }
  }

  private navigateToUserDetail(userId: string): void {
    // Route to Hours Allocation dashboard, pre-selecting the user and period
    this.router.navigate(['/dashboard/hours-allocation'], { 
      queryParams: { 
        userId: userId, 
        month: this.query.month, 
        year: this.query.year,
        from: 'capacity'
      } 
    });
  }

  private baseTooltip(): echarts.EChartsOption['tooltip'] {
    return {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'transparent',
      borderRadius: 10,
      padding: [10, 14],
      textStyle: { fontFamily: this.chartFont, fontSize: 13, fontWeight: 600, color: '#fff' },
    };
  }

  private baseAxis(label: string): any {
    return {
      nameTextStyle: { fontFamily: this.chartFont, fontSize: 11, fontWeight: 700, color: '#94a3b8' },
      axisLabel: { fontFamily: this.chartFont, fontSize: 11, fontWeight: 600, color: '#64748b' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' as const } },
      name: label,
    };
  }

  private renderMemberCapacitiesChart(): void {
    if (!this.memberCapacitiesContainer?.nativeElement) return;
    const existingChart = echarts.getInstanceByDom(this.memberCapacitiesContainer.nativeElement);
    if (existingChart) {
      existingChart.dispose();
    }
    const chart = echarts.init(this.memberCapacitiesContainer.nativeElement);
    this.charts.push(chart);
    this.setupResizeObserver(this.memberCapacitiesContainer.nativeElement, chart);

    const data = this.memberCapacitiesData;
    const totalHours = data.reduce((sum, d) => sum + d.bookedHours, 0);
    const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#ec4899', '#06b6d4'];

    const option: echarts.EChartsOption = {
      color: colorPalette,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'transparent',
        borderRadius: 10,
        padding: [10, 14],
        textStyle: { fontFamily: this.chartFont, fontSize: 13, fontWeight: 600, color: '#fff' },
        formatter: (params: any) => {
          const user = data.find(d => d.userName === params.name);
          return `<strong>${params.name}</strong><br/>${params.value}h (${user?.percentage?.toFixed(1) || 0}% of target)`;
        }
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { fontFamily: this.chartFont, fontSize: 12, fontWeight: 600, color: '#64748b' },
        itemGap: 15,
        padding: [10, 20]
      },
      graphic: [{
        type: 'group',
        left: 'center',
        top: '42%',
        children: [
          { type: 'text', style: { text: totalHours.toLocaleString(), fill: '#0f172a', font: `bold 24px ${this.chartFont}`, align: 'center' }, left: 'center', top: -12 },
          { type: 'text', style: { text: 'Total Hours', fill: '#94a3b8', font: `600 11px ${this.chartFont}`, align: 'center' }, left: 'center', top: 16 },
        ]
      }],
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      series: [{
        name: 'Capacities',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '45%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 14, shadowColor: 'rgba(0,0,0,0.12)' }
        },
        data: data.map(d => ({
          value: d.bookedHours,
          name: d.userName,
          userId: d.userId
        }))
      }]
    };
    chart.setOption(option);
    
    // Drill-down event for chart slices
    chart.on('click', (params: any) => {
      if (params.data && params.data.userId) {
        this.navigateToUserDetail(params.data.userId);
      }
    });

    // Drill-down event for legend (prevent toggle, navigate instead)
    chart.on('legendselectchanged', (params: any) => {
      // Force the legend item to stay selected so it doesn't disappear
      chart.dispatchAction({
        type: 'legendSelect',
        name: params.name
      });
      
      // Navigate to user stats
      const user = data.find(d => d.userName === params.name);
      if (user && user.userId) {
        this.navigateToUserDetail(user.userId);
      }
    });
  }

  private renderCapacityTargetChart(): void {
    if (!this.capacityTargetContainer?.nativeElement) return;
    const existingChart = echarts.getInstanceByDom(this.capacityTargetContainer.nativeElement);
    if (existingChart) {
      existingChart.dispose();
    }
    const chart = echarts.init(this.capacityTargetContainer.nativeElement);
    this.charts.push(chart);
    this.setupResizeObserver(this.capacityTargetContainer.nativeElement, chart);

    const data = this.activeCapacityTarget;
    if (!data) return;

    const remaining = data.remainingHours || 0;
    const target = data.targetHours || 0;
    const remainingPct = target > 0 ? ((remaining / target) * 100).toFixed(1) : '0';
    const remainingLabel = `${this.formatHours(remaining)}h`;
    const targetLabel = `${this.formatHours(target)}h`;

    const option: echarts.EChartsOption = {
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'transparent',
        borderRadius: 10,
        padding: [10, 14],
        textStyle: { fontFamily: this.chartFont, fontSize: 13, fontWeight: 600, color: '#fff' },
        formatter: () =>
          `<strong>Hours vs Target</strong><br/>Remaining: ${remainingLabel}<br/>Target: ${targetLabel}<br/>Booked: ${this.formatHours(data.actualBookedHours || 0)}h`
      },
      graphic: [{
        type: 'group',
        left: 'center',
        top: '58%',
        children: [
          {
            type: 'text',
            style: {
              text: 'TARGET',
              fill: '#047857',
              font: `800 11px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 0
          },
          {
            type: 'text',
            style: {
              text: targetLabel,
              fill: '#047857',
              font: `800 21px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 14
          },
          {
            type: 'text',
            style: {
              text: `${remainingPct}% remaining`,
              fill: '#64748b',
              font: `700 12px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 42
          }
        ]
      }],
      series: [{
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: target || 100,
        itemStyle: { color: '#10b981' },
        progress: { show: true, width: 18, roundCap: true },
        pointer: { show: false },
        axisLine: { roundCap: true, lineStyle: { width: 18, color: [[1, '#e2e8f0']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 28,
          fontFamily: this.chartFont,
          fontWeight: 'bold',
          color: '#0f172a',
          formatter: () => remainingLabel,
          offsetCenter: [0, '-18%']
        },
        data: [{ value: remaining, name: 'Remaining' }]
      }]
    };
    chart.setOption(option);
  }

  private renderMemberPricesChart(): void {
    if (!this.memberPricesContainer?.nativeElement) return;
    const existingChart = echarts.getInstanceByDom(this.memberPricesContainer.nativeElement);
    if (existingChart) {
      existingChart.dispose();
    }
    const chart = echarts.init(this.memberPricesContainer.nativeElement);
    this.charts.push(chart);
    this.setupResizeObserver(this.memberPricesContainer.nativeElement, chart);

    const data = this.memberPricesData;
    const totalPrice = data.reduce((sum, d) => sum + d.bookedPrice, 0);
    const colorPalette = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#f97316', '#14b8a6', '#ec4899', '#6366f1', '#06b6d4'];

    const option: echarts.EChartsOption = {
      color: colorPalette,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'transparent',
        borderRadius: 10,
        padding: [10, 14],
        textStyle: { fontFamily: this.chartFont, fontSize: 13, fontWeight: 600, color: '#fff' },
        formatter: (params: any) => {
          const user = data.find(d => d.userName === params.name);
          return `<strong>${params.name}</strong><br/>${params.value?.toLocaleString()}$ (${user?.percentage?.toFixed(1) || 0}% of target)`;
        }
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { fontFamily: this.chartFont, fontSize: 12, fontWeight: 600, color: '#64748b' },
        itemGap: 15,
        padding: [10, 20]
      },
      graphic: [{
        type: 'group',
        left: 'center',
        top: '42%',
        children: [
          { type: 'text', style: { text: `${totalPrice.toLocaleString()}$`, fill: '#0f172a', font: `bold 24px ${this.chartFont}`, align: 'center' }, left: 'center', top: -12 },
          { type: 'text', style: { text: 'Total Revenue', fill: '#94a3b8', font: `600 11px ${this.chartFont}`, align: 'center' }, left: 'center', top: 16 },
        ]
      }],
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      series: [{
        name: 'Revenue',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '45%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 14, shadowColor: 'rgba(0,0,0,0.12)' }
        },
        data: data.map(d => ({
          value: d.bookedPrice,
          name: d.userName,
          userId: d.userId
        }))
      }]
    };
    chart.setOption(option);

    // Drill-down event for chart slices
    chart.on('click', (params: any) => {
      if (params.data && params.data.userId) {
        this.navigateToUserDetail(params.data.userId);
      }
    });

    // Drill-down event for legend (prevent toggle, navigate instead)
    chart.on('legendselectchanged', (params: any) => {
      // Force the legend item to stay selected so it doesn't disappear
      chart.dispatchAction({
        type: 'legendSelect',
        name: params.name
      });
      
      // Navigate to user stats
      const user = data.find(d => d.userName === params.name);
      if (user && user.userId) {
        this.navigateToUserDetail(user.userId);
      }
    });
  }

  private renderPriceTargetChart(): void {
    if (!this.priceTargetContainer?.nativeElement) return;
    const existingChart = echarts.getInstanceByDom(this.priceTargetContainer.nativeElement);
    if (existingChart) {
      existingChart.dispose();
    }
    const chart = echarts.init(this.priceTargetContainer.nativeElement);
    this.charts.push(chart);
    this.setupResizeObserver(this.priceTargetContainer.nativeElement, chart);

    const data = this.activePriceTarget;
    if (!data) return;

    const remaining = data.remainingPrice || 0;
    const booked = data.bookedPrice || 0;
    const target = this.priceTargetAmount;
    const remainingPct = target > 0 ? ((remaining / target) * 100).toFixed(1) : '0';
    const targetLabel = `${this.formatFullNumber(target)}$`;
    const remainingLabel = `${this.formatFullNumber(remaining)}$`;

    const option: echarts.EChartsOption = {
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'transparent',
        borderRadius: 10,
        padding: [10, 14],
        textStyle: { fontFamily: this.chartFont, fontSize: 13, fontWeight: 600, color: '#fff' },
        formatter: () =>
          `<strong>Revenue vs Target</strong><br/>Remaining: ${remainingLabel}<br/>Target: ${targetLabel}<br/>Booked: ${this.formatFullNumber(booked)}$`
      },
      graphic: [{
        type: 'group',
        left: 'center',
        top: '58%',
        children: [
          {
            type: 'text',
            style: {
              text: 'TARGET',
              fill: '#6d28d9',
              font: `800 11px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 0
          },
          {
            type: 'text',
            style: {
              text: targetLabel,
              fill: '#6d28d9',
              font: `800 21px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 14
          },
          {
            type: 'text',
            style: {
              text: `${remainingPct}% remaining`,
              fill: '#64748b',
              font: `700 12px ${this.chartFont}`,
              align: 'center'
            },
            left: 'center',
            top: 42
          }
        ]
      }],
      series: [{
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: target || 100,
        itemStyle: { color: '#8b5cf6' },
        progress: { show: true, width: 18, roundCap: true },
        pointer: { show: false },
        axisLine: { roundCap: true, lineStyle: { width: 18, color: [[1, '#e2e8f0']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 26,
          fontFamily: this.chartFont,
          fontWeight: 'bold',
          color: '#0f172a',
          formatter: () => remainingLabel,
          offsetCenter: [0, '-18%']
        },
        data: [{ value: remaining, name: 'Remaining' }]
      }]
    };
    chart.setOption(option);
  }

  loadSynthesisData(): void {
    this.isLoadingSynthesis = true;
    
    this.analyticsService.getMemberTahDashboard({
      fiscalYear: this.query.year,
      tahMonthlyHoursTarget: this.query.targetHoursPerMember
    }).subscribe({
      next: (dashboardData) => {
        this.totalTeCount = dashboardData.summary.employeeCount;
        this.totalSubcontractorCount = dashboardData.summary.subcontractorCount;
        this.totalYtdTah = dashboardData.summary.cumulativeTahHours;
        this.avgYtdEffectiveness = dashboardData.summary.averageEffectiveness;

        this.synthesisData = (dashboardData.monthlyBreakdown || []).map(item => {
          let status: 'optimal' | 'warning' | 'neutral' = 'neutral';
          if (item.averageEffectiveness >= 90) status = 'optimal';
          else if (item.averageEffectiveness >= 75) status = 'warning';

          return {
            month: item.month,
            monthName: item.monthName,
            teEmployeesCount: item.employeeCount,
            teHours: item.employeeTahHours,
            subcontractorsCount: item.subcontractorCount,
            subcontractorHours: item.subcontractorTahHours,
            tEffectiveness: item.averageEffectiveness,
            tah: item.tahHours,
            targetHours: this.query.targetHoursPerMember || 172, // You might need a more precise target hours here depending on requirements
            employeeSharePercentage: item.employeeSharePercentage,
            subcontractorSharePercentage: item.subcontractorSharePercentage,
            status
          };
        });

        this.isLoadingSynthesis = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.synthesisData = [];
        this.totalTeCount = 0;
        this.totalSubcontractorCount = 0;
        this.totalYtdTah = 0;
        this.avgYtdEffectiveness = 0;
        this.isLoadingSynthesis = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredSynthesisData(): MonthlySynthesisItem[] {
    if (!this.synthesisSearchQuery.trim()) return this.synthesisData;
    const q = this.synthesisSearchQuery.toLowerCase();
    return this.synthesisData.filter(item => 
      item.monthName.toLowerCase().includes(q) ||
      item.tah.toString().includes(q) ||
      item.tEffectiveness.toString().includes(q) ||
      item.teEmployeesCount.toString().includes(q) ||
      item.subcontractorsCount.toString().includes(q)
    );
  }

  openSynthesisModal(): void {
    this.isSynthesisModalOpen = true;
    if (!this.synthesisData.length) {
      this.loadSynthesisData();
    }
  }

  closeSynthesisModal(): void {
    this.isSynthesisModalOpen = false;
  }

  exportSynthesisCsv(): void {
    const rows = this.isSynthesisModalOpen ? this.filteredSynthesisData : this.synthesisData;
    if (!rows.length) {
      this.errorMessage = this.isSynthesisModalOpen
        ? 'No data found for this search.'
        : 'No data available.';
      return;
    }

    if (this.isExportingSynthesis) {
      return;
    }

    this.isExportingSynthesis = true;
    this.errorMessage = '';

    try {
      const header = [
        'Month',
        'TE (Employees)',
        'Subcontractors',
        'TEffectiveness',
        'TAH (Hours)',
        'TE / Sub Ratio',
      ];

      const body = rows.map((item) => [
        item.month === this.query.month ? `${item.monthName} (Current)` : item.monthName,
        `${item.teEmployeesCount} TE (${this.formatExportNumber(item.teHours, 0)}h)`,
        `${item.subcontractorsCount} Sub (${this.formatExportNumber(item.subcontractorHours, 0)}h)`,
        `${this.formatExportNumber(item.tEffectiveness, 1)}%`,
        `${this.formatExportNumber(item.tah, 1)} h`,
        `TE: ${this.formatExportNumber(item.employeeSharePercentage, 1)}% | Sub: ${this.formatExportNumber(item.subcontractorSharePercentage, 1)}%`,
      ]);

      const totals = [
        'Total / Annual Average',
        `${this.totalTeCount} TE`,
        `${this.totalSubcontractorCount} Sub`,
        `${this.avgYtdEffectiveness}%`,
        `${this.formatExportNumber(this.totalYtdTah, 1)} h`,
        '',
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([header, ...body, totals]);
      worksheet['!cols'] = [
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 32 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Synthesis');
      XLSX.writeFile(workbook, `monthly_synthesis_${this.query.year}.xlsx`);
    } catch {
      this.errorMessage = 'Unable to export the monthly synthesis table right now.';
    } finally {
      this.isExportingSynthesis = false;
      this.cdr.markForCheck();
    }
  }

  private formatExportNumber(value: number, fractionDigits: number): string {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }
}
