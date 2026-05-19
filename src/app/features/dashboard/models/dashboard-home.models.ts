import { FilterTicket } from '../services/dashboard-filter.service';

export type FilterKind =
  | 'businessUnit'
  | 'department'
  | 'plant'
  | 'projectManagement'
  | 'phase'
  | 'status';

export interface FilterSection {
  kind: FilterKind;
  title: string;
  icon: string;
  tickets: FilterTicket[];
  selectedId: string;
}

export interface DashboardStatsSnapshot {
  totalProjects: number;
  averageOtd: number;
  averageEffectiveness: number;
  delayedProjects: number;
  aboveTargetCount: number;
  belowTargetCount: number;
}
