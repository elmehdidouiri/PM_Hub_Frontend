import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { ProjectDto } from '../models';
import { ProjectService } from '../services/project';

export const projectDetailsResolver: ResolveFn<ProjectDto> = (route) => {
  const id = route.paramMap.get('id');

  if (!id) {
    throw new Error('Project id is required.');
  }

  return inject(ProjectService).getProject(id);
};
