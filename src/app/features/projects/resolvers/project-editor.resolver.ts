import { ResolveFn } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { of } from 'rxjs';

import { ProjectDto } from '../models';
import { ProjectService } from '../services/project';

export const projectEditorResolver: ResolveFn<ProjectDto | null> = (route) => {
  const platformId = inject(PLATFORM_ID);
  const id = route.paramMap.get('id');

  if (!id) {
    return of(null);
  }

  if (!isPlatformBrowser(platformId)) {
    return of(null);
  }

  return inject(ProjectService).getProject(id);
};
