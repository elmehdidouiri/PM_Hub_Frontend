import { DashboardMetric } from '../../models/dashboard-metric.model';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { catchError, finalize, of } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  HoursAllocationByProjectDto,
  HoursAllocationByRoleDto,
  HoursAllocationByTeamDto,
  HoursAllocationByUserDto,
  HoursAllocationDashboardDto,
  HoursAllocationDashboardParams,
  HoursAllocationDetailDto,
  HoursAllocationFiltersDto,
  ProjectBookingHoursPreviewDto,
} from '../../models/hours-allocation-dashboard.models';
import { HoursAllocationDashboardService } from '../../services/hours-allocation-dashboard.service';

type QuickSelect = 'month' | 'year' | 'ytd';
type AnalysisMode = 'resourcesCapacity' | 'team' | 'details' | 'projects' | 'roles';
type ExportTableKey = AnalysisMode;
type ExportCell = string | number | boolean | null;

interface ExportColumn<T> {
  header: string;
  value: (row: T) => ExportCell;
}

interface SummaryCard extends DashboardMetric {}

import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { LoadingService } from '../../../../shared/services/loading.service';

@Component({
  selector: 'app-hours-allocation-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, LoadingSpinner],
  templateUrl: './hours-allocation-dashboard.html',
  styleUrl: './hours-allocation-dashboard.scss',
})
export class HoursAllocationDashboard implements OnInit {
  private readonly service = inject(HoursAllocationDashboardService);
  private readonly loadingService = inject(LoadingService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly now = new Date();

  filters: HoursAllocationFiltersDto = this.emptyFilters();
  dashboard: HoursAllocationDashboardDto | null = null;
  bookingHoursPreview: ProjectBookingHoursPreviewDto[] = [];
  isLoading = true;
  isRefreshing = false;
  isSendingReminders = false;
  isLoadingBookingHoursPreview = false;
  isExportingBookingHours = false;
  showAdvancedFilters = false;
  errorMessage = '';
  successMessage = '';

  selectedUserId: string | null = null;
  selectedProjectId: string | null = null;
  selectedRoleId: string | null = null;
  selectedQuickSelect: QuickSelect = 'month';
  selectedAnalysis: AnalysisMode = 'resourcesCapacity';
  selectedYear = this.now.getFullYear();
  selectedMonth = this.now.getMonth() + 1;
  fromDate = this.toDateInputValue(new Date(this.now.getFullYear(), this.now.getMonth(), 1));
  toDate = this.toDateInputValue(new Date(this.now.getFullYear(), this.now.getMonth() + 1, 0));

  currentPage = 1;
  pageSize = 10;
  bookingHoursPage = 1;
  bookingHoursPageSize = 10;
  all = false;
  readonly availablePageSizes = [5, 10, 20, 100];

  private latestRequest = 0;
  private latestBookingHoursPreviewRequest = 0;

  ngOnInit(): void {
    this.loadInitialData();
  }

  get summaryCards(): SummaryCard[] {
    const summary = this.dashboard?.summary;
    return [
      {
        label: 'Total Hours',
        value: this.formatHours(summary?.totalHours),
        note: String(this.selectedYear),
        icon: 'schedule',
        tone: 'orange',
        actionLabel: 'Open details',
      },
      {
        label: 'Projects',
        value: this.formatNumber(summary?.projects),
        note: 'Active projects',
        icon: 'folder',
        tone: 'orange',
        actionLabel: 'Open projects analysis',
      },
      {
        label: 'Allocations',
        value: this.formatNumber(summary?.allocations),
        note: 'Allocation rows',
        icon: 'assignment',
        tone: 'amber',
        actionLabel: 'Open allocations',
      },
      {
        label: 'Avg Utilization',
        value: this.formatPercent(summary?.averageUtilization),
        note: 'Capacity usage',
        icon: 'trending_up',
        tone: 'green',
        actionLabel: 'Open capacity',
      },
    
      {
        label: 'Avg Monthly',
        value: this.formatHours(summary?.averageMonthlyHours),
        note: `${this.dashboard?.monthlyBreakdown?.length ?? 0} months`,
        icon: 'equalizer',
        tone: 'neutral',
        actionLabel: 'Open details',
      },
    ];
  }

  get totalDetailedHours(): number {
    return this.dashboard?.details.reduce((total, item) => total + item.totalHours, 0) ?? 0;
  }

  get maxMonthHours(): number {
    return Math.max(1, ...(this.dashboard?.monthlyBreakdown ?? []).map((item) => item.totalHours));
  }

  get years(): number[] {
    const years = new Set<number>(this.filters.fiscalYears);
    for (let year = this.now.getFullYear() + 1; year >= this.now.getFullYear() - 5; year--) {
      years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }

  get months() {
    return this.filters.months.length ? this.filters.months : this.defaultMonths();
  }

  get headerPeriodLabel(): string {
    if (this.selectedQuickSelect === 'month') {
      const month = this.months.find((item) => item.value === this.selectedMonth);
      return `${month?.label ?? 'Month'} ${this.selectedYear}`;
    }

    if (this.selectedQuickSelect === 'year') {
      return `Year ${this.selectedYear}`;
    }

    return `YTD ${this.selectedYear}`;
  }

  get headerPeriodRange(): string {
    const from = this.formatHeaderDate(this.fromDate);
    const to = this.formatHeaderDate(this.toDate);
    return `${from} – ${to}`;
  }

  get bookingHoursTotalHeader(): string {
    return `Total Booking Hours ${this.headerPeriodLabel}`;
  }

  get bookedBookingHoursPreview(): ProjectBookingHoursPreviewDto[] {
    return this.bookingHoursPreview.filter((row) => Number(row.totalBookingHours ?? 0) > 0);
  }

  get pagedBookingHoursPreview(): ProjectBookingHoursPreviewDto[] {
    const start = (this.bookingHoursPage - 1) * this.bookingHoursPageSize;
    return this.bookedBookingHoursPreview.slice(start, start + this.bookingHoursPageSize);
  }

  get bookingHoursTotalCount(): number {
    return this.bookedBookingHoursPreview.length;
  }

  get bookingHoursTotalPages(): number {
    return Math.max(1, Math.ceil(this.bookingHoursTotalCount / this.bookingHoursPageSize));
  }

  get bookingHoursPageStart(): number {
    return this.bookingHoursTotalCount ? (this.bookingHoursPage - 1) * this.bookingHoursPageSize + 1 : 0;
  }

  get bookingHoursPageEnd(): number {
    return Math.min(this.bookingHoursPage * this.bookingHoursPageSize, this.bookingHoursTotalCount);
  }

  reload(): void {
    this.currentPage = 1;
    this.bookingHoursPage = 1;
    this.loadDashboard(false);
    this.loadBookingHoursPreview();
  }

  onAnalysisChanged(): void {
    this.currentPage = 1;
    this.reload();
  }

  openSummaryCardTarget(card: SummaryCard): void {
    const label = card.label.toLowerCase();

    if (label === 'projects') {
      this.selectedAnalysis = 'projects';
      this.onAnalysisChanged();
      return;
    }

    if (label === 'avg utilization') {
      this.selectedAnalysis = 'resourcesCapacity';
      this.onAnalysisChanged();
      return;
    }

    this.selectedAnalysis = 'details';
    this.onAnalysisChanged();
  }

  onPageChange(page: number): void {
    const totalPages = this.dashboard?.pagination?.totalPages ?? 1;
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.loadDashboard(false);
    }
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.loadDashboard(false);
  }

  onBookingHoursPageChange(page: number): void {
    if (page >= 1 && page <= this.bookingHoursTotalPages) {
      this.bookingHoursPage = page;
    }
  }

  onBookingHoursPageSizeChange(newSize: number): void {
    this.bookingHoursPageSize = Number(newSize);
    this.bookingHoursPage = 1;
  }

  getVisiblePages(): number[] {
    const total = this.dashboard?.pagination?.totalPages ?? 0;
    const current = this.currentPage;

    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  getVisibleBookingHoursPages(): number[] {
    const total = this.bookingHoursTotalPages;
    const current = this.bookingHoursPage;

    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  selectQuick(value: QuickSelect): void {
    this.selectedQuickSelect = value;

    if (value === 'month') {
      this.fromDate = this.toDateInputValue(new Date(this.selectedYear, this.selectedMonth - 1, 1));
      this.toDate = this.toDateInputValue(new Date(this.selectedYear, this.selectedMonth, 0));
    }

    if (value === 'year') {
      this.fromDate = `${this.selectedYear}-01-01`;
      this.toDate = `${this.selectedYear}-12-31`;
    }

    if (value === 'ytd') {
      this.fromDate = `${this.selectedYear}-01-01`;
      this.toDate = this.toDateInputValue(this.now);
    }

    this.reload();
  }

  onYearChanged(): void {
    this.selectQuick(this.selectedQuickSelect);
  }

  onMonthChanged(): void {
    this.selectedQuickSelect = 'month';
    this.selectQuick('month');
  }

  sendReminders(): void {
    this.isSendingReminders = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.service
      .sendReminders(this.buildParams())
      .pipe(
        finalize(() => {
          this.isSendingReminders = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Reminders sent successfully.';
        },
        error: () => {
          this.errorMessage = 'Unable to send reminders right now.';
        },
      });
  }

  loadBookingHoursPreview(): void {
    const requestId = ++this.latestBookingHoursPreviewRequest;
    this.isLoadingBookingHoursPreview = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.service
      .getProjectBookingHoursPreview(this.buildBookingHoursParams())
      .pipe(
        finalize(() => {
          if (requestId === this.latestBookingHoursPreviewRequest) {
            this.isLoadingBookingHoursPreview = false;
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (rows) => {
          if (requestId === this.latestBookingHoursPreviewRequest) {
            this.bookingHoursPreview = rows;
            this.bookingHoursPage = 1;
          }
        },
        error: () => {
          if (requestId === this.latestBookingHoursPreviewRequest) {
            this.bookingHoursPreview = [];
            this.errorMessage = 'Unable to load projects booking hours preview.';
          }
        },
      });
  }

  exportProjectBookingHours(): void {
    const rows = this.bookedBookingHoursPreview;
    if (!rows.length) {
      this.errorMessage = 'No booked projects to export for the selected filters.';
      return;
    }

    this.isExportingBookingHours = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const exportRows = rows.map((row) => ({
        Projects: row.project,
        Phase: row.phase,
        'Estimated Hours': row.estimatedHours,
        Departement: row.department,
        Sponsor: row.sponsor,
        'Cost Center': row.costCenter,
        [this.bookingHoursTotalHeader]: row.totalBookingHours,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = Object.keys(exportRows[0]).map((header) => ({
        wch: Math.max(16, header.length + 2),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Booking Hours');
      XLSX.writeFile(workbook, 'Projects_BookingHours_Export.xlsx');
      this.successMessage = 'Projects booking hours exported successfully.';
    } catch {
      this.errorMessage = 'Unable to export projects booking hours right now.';
    } finally {
      this.isExportingBookingHours = false;
      this.cdr.markForCheck();
    }
  }

  exportDisplayedTable(table: ExportTableKey): void {
    if (!this.dashboard) {
      return;
    }

    const exportConfig = this.getExportConfig(table, this.dashboard);
    if (!exportConfig.rows.length) {
      this.errorMessage = 'No rows to export for the displayed table.';
      return;
    }

    const rows = exportConfig.rows.map((row) =>
      exportConfig.columns.reduce<Record<string, ExportCell>>((acc, column) => {
        acc[column.header] = column.value(row);
        return acc;
      }, {}),
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = exportConfig.columns.map((column) => ({
      wch: Math.max(14, column.header.length + 2),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, this.toSheetName(exportConfig.title));
    XLSX.writeFile(workbook, `${this.toFileName(exportConfig.title)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    this.successMessage = `${exportConfig.title} exported successfully.`;
  }

  hasExportRows(table: ExportTableKey): boolean {
    if (!this.dashboard) {
      return false;
    }

    return this.getRowsForExport(table, this.dashboard).length > 0;
  }

  trackById(_: number, item: { userId?: string; projectId?: string; roleId?: string; memberId?: string }): string {
    return item.userId || item.projectId || item.roleId || item.memberId || String(_);
  }

  trackByDate(_: number, item: { date: string; userId: string; projectId: string }): string {
    return `${item.date}-${item.userId}-${item.projectId}`;
  }

  trackByMonth(_: number, item: { year: number; month: number }): string {
    return `${item.year}-${item.month}`;
  }

  trackByBookingHoursProject(index: number, item: ProjectBookingHoursPreviewDto): string {
    return `${item.project}-${item.phase}-${index}`;
  }

  monthWidth(hours: number): number {
    return Math.max(0, Math.min(100, (Number(hours || 0) / this.maxMonthHours) * 100));
  }

  formatHours(value: unknown): string {
    return `${this.formatNumber(value)}h`;
  }

  formatNumber(value: unknown): string {
    const parsed = Number(value ?? 0);
    return new Intl.NumberFormat('en', {
      minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(parsed) ? parsed : 0);
  }

  formatPercent(value: unknown): string {
    const parsed = Number(value ?? 0);
    return `${Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0'}%`;
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.loadingService.show();
    this.errorMessage = '';

    this.service
      .getFilters()
      .pipe(catchError(() => of(this.emptyFilters())))
      .subscribe((filters) => {
        this.filters = this.normalizeFilters(filters);
        this.cdr.markForCheck();
      });

    this.loadDashboard(true);
    this.loadBookingHoursPreview();
  }

  private loadDashboard(initial: boolean): void {
    const requestId = ++this.latestRequest;
    this.isLoading = initial;
    this.isRefreshing = !initial;
    this.errorMessage = '';
    this.successMessage = '';

    this.service
      .getDashboard(this.buildParams())
      .pipe(
        finalize(() => {
          if (requestId === this.latestRequest) {
            this.isLoading = false;
            this.isRefreshing = false;
            this.loadingService.hide();
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (dashboard) => {
          if (requestId === this.latestRequest) {
            this.dashboard = dashboard;
            if (dashboard.pagination) {
              this.currentPage = dashboard.pagination.pageNumber;
              this.pageSize = dashboard.pagination.pageSize;
            }
          }
        },
        error: () => {
          if (requestId === this.latestRequest) {
            this.dashboard = null;
            this.errorMessage = 'Unable to load hours allocation with the selected filters.';
          }
        },
      });
  }

  private buildParams(): HoursAllocationDashboardParams {
    const isMonth = this.selectedQuickSelect === 'month';
    return {
      userId: this.selectedUserId,
      memberId: null,
      projectId: this.selectedProjectId,
      roleId: this.selectedRoleId,
      year: this.selectedYear,
      month: isMonth ? this.selectedMonth : null,
      fromDate: isMonth ? this.fromDate : null,
      toDate: isMonth ? this.toDate : null,
      quickSelect: this.selectedQuickSelect,
      analysis: this.selectedAnalysis,
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
      all: this.all ? true : null,
    };
  }

  private buildBookingHoursParams(): Record<string, string | number | null | undefined> {
    return {
      userId: this.selectedUserId,
      projectId: this.selectedProjectId,
      roleId: this.selectedRoleId,
      year: this.selectedYear,
      month: this.selectedQuickSelect === 'month' ? this.selectedMonth : null,
      startDate: this.getExportStartDate(),
      endDate: this.getExportEndDate(),
    };
  }

  private getExportStartDate(): string | null {
    if (this.selectedQuickSelect === 'ytd') {
      return `${this.selectedYear}-01-01`;
    }

    return this.fromDate || null;
  }

  private getExportEndDate(): string | null {
    if (this.selectedQuickSelect === 'ytd') {
      return this.toDate || this.toDateInputValue(this.now);
    }

    return this.toDate || null;
  }

  private getFileNameFromContentDisposition(contentDisposition: string | null): string {
    const fallback = 'Projects_BookingHours_Export.xlsx';
    if (!contentDisposition) {
      return fallback;
    }

    const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1].trim());
    }

    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return match?.[1]?.trim() || fallback;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  private getExportConfig(table: ExportTableKey, dashboard: HoursAllocationDashboardDto): {
    title: string;
    rows: Array<HoursAllocationDetailDto | HoursAllocationByUserDto | HoursAllocationByProjectDto | HoursAllocationByRoleDto | HoursAllocationByTeamDto>;
    columns: Array<ExportColumn<HoursAllocationDetailDto | HoursAllocationByUserDto | HoursAllocationByProjectDto | HoursAllocationByRoleDto | HoursAllocationByTeamDto>>;
  } {
    switch (table) {
      case 'details':
        return {
          title: 'Detailed Allocations',
          rows: dashboard.details,
          columns: [
            { header: 'Date', value: (row) => this.formatDate((row as HoursAllocationDetailDto).date) },
            { header: 'User', value: (row) => (row as HoursAllocationDetailDto).userName },
            { header: 'Project', value: (row) => (row as HoursAllocationDetailDto).projectName },
            { header: 'Type', value: (row) => (row as HoursAllocationDetailDto).type || 'Daily' },
            { header: 'Execution', value: (row) => (row as HoursAllocationDetailDto).executionHours },
            { header: 'Tech Lead', value: (row) => (row as HoursAllocationDetailDto).techLeadHours },
            { header: 'Process', value: (row) => (row as HoursAllocationDetailDto).processHours },
            { header: 'Project Mgmt', value: (row) => (row as HoursAllocationDetailDto).projectManagementHours },
            { header: 'R&D', value: (row) => (row as HoursAllocationDetailDto).researchAndDevHours },
            { header: 'Workshop', value: (row) => (row as HoursAllocationDetailDto).workshopHours },
            { header: 'Total', value: (row) => (row as HoursAllocationDetailDto).totalHours },
          ],
        };
      case 'resourcesCapacity':
        return {
          title: 'Hours by User',
          rows: dashboard.hoursByUser,
          columns: [
            { header: 'User', value: (row) => (row as HoursAllocationByUserDto).userName },
            { header: 'Role', value: (row) => (row as HoursAllocationByUserDto).role },
            { header: 'Department', value: (row) => (row as HoursAllocationByUserDto).department },
            { header: 'Allocated', value: (row) => (row as HoursAllocationByUserDto).allocatedHours },
            { header: 'Available', value: (row) => (row as HoursAllocationByUserDto).availableHours },
            { header: 'Utilization', value: (row) => (row as HoursAllocationByUserDto).utilizationPercentage },
            { header: 'Execution', value: (row) => (row as HoursAllocationByUserDto).executionHours },
            { header: 'Project Mgmt', value: (row) => (row as HoursAllocationByUserDto).projectManagementHours },
            { header: 'R&D', value: (row) => (row as HoursAllocationByUserDto).researchAndDevHours },
            { header: 'Projects', value: (row) => (row as HoursAllocationByUserDto).projectCount },
          ],
        };
      case 'projects':
        return {
          title: 'Hours by Project',
          rows: dashboard.hoursByProject,
          columns: [
            { header: 'Project', value: (row) => (row as HoursAllocationByProjectDto).projectName },
            { header: 'Total Hours', value: (row) => (row as HoursAllocationByProjectDto).totalHours },
            { header: 'PM Hours', value: (row) => (row as HoursAllocationByProjectDto).projectManagerHours },
            { header: 'Team Hours', value: (row) => (row as HoursAllocationByProjectDto).teamHours },
            { header: 'Team Members', value: (row) => (row as HoursAllocationByProjectDto).teamMembers },
            { header: 'Allocations', value: (row) => (row as HoursAllocationByProjectDto).allocations },
          ],
        };
      case 'roles':
        return {
          title: 'Hours by Role',
          rows: dashboard.hoursByRole,
          columns: [
            { header: 'Role', value: (row) => (row as HoursAllocationByRoleDto).role },
            { header: 'Total Hours', value: (row) => (row as HoursAllocationByRoleDto).totalHours },
            { header: 'Members', value: (row) => (row as HoursAllocationByRoleDto).teamMembers },
            { header: 'Percentage', value: (row) => (row as HoursAllocationByRoleDto).percentage },
          ],
        };
      case 'team':
        return {
          title: 'Team Performance',
          rows: dashboard.hoursByTeam,
          columns: [
            { header: 'Member', value: (row) => (row as HoursAllocationByTeamDto).memberName },
            { header: 'Project', value: (row) => (row as HoursAllocationByTeamDto).projectName },
            { header: 'Total Hours', value: (row) => (row as HoursAllocationByTeamDto).totalHours },
            { header: 'Worked Days', value: (row) => (row as HoursAllocationByTeamDto).workedDays },
            { header: 'Allocations', value: (row) => (row as HoursAllocationByTeamDto).allocationCount },
          ],
        };
    }
  }

  private getRowsForExport(
    table: ExportTableKey,
    dashboard: HoursAllocationDashboardDto,
  ): Array<HoursAllocationDetailDto | HoursAllocationByUserDto | HoursAllocationByProjectDto | HoursAllocationByRoleDto | HoursAllocationByTeamDto> {
    switch (table) {
      case 'details':
        return dashboard.details;
      case 'resourcesCapacity':
        return dashboard.hoursByUser;
      case 'projects':
        return dashboard.hoursByProject;
      case 'roles':
        return dashboard.hoursByRole;
      case 'team':
        return dashboard.hoursByTeam;
    }
  }

  private toFileName(value: string): string {
    return `PMHUB_${value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}`;
  }

  private toSheetName(value: string): string {
    return value.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Export';
  }

  private normalizeFilters(filters: HoursAllocationFiltersDto): HoursAllocationFiltersDto {
    return {
      users: filters.users ?? [],
      projects: filters.projects ?? [],
      roles: filters.roles ?? [],
      members: filters.members ?? [],
      fiscalYears: filters.fiscalYears?.length ? filters.fiscalYears : this.years,
      months: filters.months?.length ? filters.months : this.defaultMonths(),
    };
  }

  private emptyFilters(): HoursAllocationFiltersDto {
    return {
      users: [],
      projects: [],
      roles: [],
      members: [],
      fiscalYears: [],
      months: this.defaultMonths(),
    };
  }

  private defaultMonths(): Array<{ value: number; label: string }> {
    return Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)),
    }));
  }

  private toDateInputValue(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private formatHeaderDate(value: string): string {
    if (!value) {
      return '—';
    }

    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value.toUpperCase();
    }

    return date
      .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      .toUpperCase();
  }
}
