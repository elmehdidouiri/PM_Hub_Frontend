import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HourEntry } from './pages/hour-entry/hour-entry';
import { HourSummary } from './pages/hour-summary/hour-summary';

const routes: Routes = [
  {
    path: '',
    component: HourEntry
  },
  {
    path: 'summary',
    component: HourSummary
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HoursRoutingModule { }
