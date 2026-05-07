import { ResolveFn } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { of, EMPTY } from 'rxjs';

import { ProjectDto } from '../models';
import { ProjectService } from '../services/project';

export const projectDetailsResolver: ResolveFn<ProjectDto | null> = (route) => {
  const platformId = inject(PLATFORM_ID);
  const id = route.paramMap.get('id');

  if (!id) {
    return of(null);
  }

  // On server, we can't authenticate (no localStorage), so we skip fetching
  // to avoid 401 errors. The client will fetch the data once it hydrates.
  if (!isPlatformBrowser(platformId)) {
    return of(null);
  }

  return inject(ProjectService).getProject(id);
};
