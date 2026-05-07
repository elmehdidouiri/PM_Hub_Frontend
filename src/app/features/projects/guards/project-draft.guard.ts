import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

import { ProjectCreatePage } from '../pages/project-create-page/project-create-page';

export const projectDraftGuard: CanDeactivateFn<ProjectCreatePage> = (
  component
): Observable<boolean> | boolean => component.canDeactivate();
