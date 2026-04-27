import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Role } from '../models';

/**
 * Service pour la gestion des rôles
 */
@Injectable({
  providedIn: 'root'
})
export class RoleService {

  private apiUrl = `${environment.apiUrl}/roles`;
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Récupérer tous les rôles actifs
   * @returns Observable<Role[]>
   */
  getRoles(): Observable<Role[]> {
    if (!this.isBrowser) {
      return of([]);
    }

    return this.http.get<ApiResponse<Role[]>>(this.apiUrl).pipe(
      map(response => {
        if (response.success && response.data) {
           return response.data.filter(role => role.isActive);
        }
        return [];
      })
    );
  }

  /**
   * Récupérer un rôle par ID
   * @param id - ID du rôle
   * @returns Observable<Role | null>
   */
  getRoleById(id: string): Observable<Role | null> {
    return this.http.get<ApiResponse<Role>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      })
    );
  }
}
