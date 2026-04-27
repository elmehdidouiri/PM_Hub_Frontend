import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { ProjectReferenceData } from '../models';
import { ProjectReferenceService } from '../services/project-reference.service';

export const projectReferencesResolver: ResolveFn<ProjectReferenceData> = () => {
  return inject(ProjectReferenceService).loadAll();
};
