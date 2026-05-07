import { Component, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';

import { ProjectForm } from '../project-form/project-form';

@Component({
  selector: 'app-project-create-page',
  template: `<app-project-form></app-project-form>`,
  standalone: false,
})
export class ProjectCreatePage {
  @ViewChild(ProjectForm) private projectForm?: ProjectForm;

  canDeactivate(): Observable<boolean> | boolean {
    return this.projectForm?.confirmDiscardOrSave() ?? true;
  }
}
