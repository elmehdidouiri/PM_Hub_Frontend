import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface InternDto {
  id: string;
  name?: string; // Full name from API
  firstName?: string;
  lastName?: string;
  email: string;
  roleName?: string;
  supervisorId: string;
  supervisorName: string;
  supervisorEmail?: string;
  departmentId?: string;
  departmentName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class InternsApiService {
  private readonly apiUrl = `${environment.apiUrl}/interns`;

  constructor(private readonly http: HttpClient) {}

  getInternsBySupervisor(supervisorId: string): Observable<InternDto[]> {
    return this.http
      .get<ApiResponse<InternDto[]>>(`${this.apiUrl}/supervisor/${supervisorId}`)
      .pipe(map((response) => response.data || []));
  }
}
