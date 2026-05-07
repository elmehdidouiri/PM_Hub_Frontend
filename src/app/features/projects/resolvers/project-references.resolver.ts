import { ResolveFn } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, of, timeout } from 'rxjs';

import { ProjectReferenceData } from '../models';
import { ProjectReferenceService } from '../services/project-reference.service';

export const projectReferencesResolver: ResolveFn<ProjectReferenceData | null> = () => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return of(null);
  }

  return inject(ProjectReferenceService).loadAll().pipe(
    timeout(8000),
    catchError(() => of(null))
  );
};
