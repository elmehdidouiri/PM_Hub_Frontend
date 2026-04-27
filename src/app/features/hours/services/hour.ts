import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateHourEntryDto,
  HourEntryDto,
  HourEntryMyProjectDto,
  HourEntryPremiumApproveDto,
  HourEntryUpdateDto,
  ProjectInternAllocationDto,
} from '../../../core/models/hour-entry.model';
import { HourEntriesApiService } from '../../../core/services/hour-entries-api.service';
import { HourSummaryApiService } from '../../../core/services/hour-summary-api.service';

@Injectable({
  providedIn: 'root',
})
export class Hour {
  constructor(
    private readonly hourEntriesApi: HourEntriesApiService,
    private readonly hourSummaryApi: HourSummaryApiService
  ) {}

  createEntry(payload: CreateHourEntryDto): Observable<HourEntryDto | null> {
    return this.hourEntriesApi.create(payload);
  }

  updateEntry(id: string, payload: HourEntryUpdateDto): Observable<HourEntryDto | null> {
    return this.hourEntriesApi.update(id, payload);
  }

  deleteEntry(id: string): Observable<void> {
    return this.hourEntriesApi.delete(id);
  }

  myEntries(): Observable<HourEntryDto[]> {
    return this.hourEntriesApi.getMy();
  }

  myEntriesByDate(date: string): Observable<HourEntryDto[]> {
    return this.hourEntriesApi.getMyByDate(date);
  }

  myEntriesByMonth(year: number, month: number): Observable<HourEntryDto[]> {
    return this.hourEntriesApi.getMyByMonth(year, month);
  }

  projectEntries(projectId: string): Observable<HourEntryDto[]> {
    return this.hourEntriesApi.getByProject(projectId);
  }

  dashboardMonthly(year: number, month: number): Observable<unknown | null> {
    return this.hourEntriesApi.getDashboardMonthly(year, month);
  }

  dashboardYtd(companyYear: string | number): Observable<unknown | null> {
    return this.hourEntriesApi.getDashboardYtd(companyYear);
  }

  myProjects(): Observable<HourEntryMyProjectDto[]> {
    return this.hourEntriesApi.getMyProjects();
  }

  mySupervisedInterns(): Observable<ProjectInternAllocationDto[]> {
    return this.hourEntriesApi.getMySupervisedInterns();
  }

  premiumPending(): Observable<HourEntryDto[]> {
    return this.hourEntriesApi.getPremiumPending();
  }

  approvePremium(payload: HourEntryPremiumApproveDto): Observable<void> {
    return this.hourEntriesApi.approvePremium(payload);
  }

  summaryMonthly(year: number): Observable<unknown | null> {
    return this.hourSummaryApi.monthly(year);
  }

  summaryMonthlyMe(year: number): Observable<unknown | null> {
    return this.hourSummaryApi.meMonthly(year);
  }

  summaryProject(year: number): Observable<unknown | null> {
    return this.hourSummaryApi.project(year);
  }

  summaryProjectMe(year: number): Observable<unknown | null> {
    return this.hourSummaryApi.meProject(year);
  }

  summaryUser(year: number): Observable<unknown | null> {
    return this.hourSummaryApi.user(year);
  }

  summaryTopProjects(year: number, topCount: number): Observable<unknown | null> {
    return this.hourSummaryApi.topProjects(year, topCount);
  }

  summaryTopProjectsMe(year: number, topCount: number): Observable<unknown | null> {
    return this.hourSummaryApi.meTopProjects(year, topCount);
  }

  summaryTotalHours(params: { year: number; month: number; userId?: string; projectId?: string }): Observable<unknown | null> {
    return this.hourSummaryApi.totalHours(params);
  }

  summaryTotalHoursMe(params: { year: number; month: number; projectId?: string }): Observable<unknown | null> {
    return this.hourSummaryApi.meTotalHours(params);
  }

  summaryBreakdown(params: { year: number; month: number; userId?: string; projectId?: string }): Observable<unknown | null> {
    return this.hourSummaryApi.breakdown(params);
  }

  summaryBreakdownMe(params: { year: number; month: number; projectId?: string }): Observable<unknown | null> {
    return this.hourSummaryApi.meBreakdown(params);
  }
}
