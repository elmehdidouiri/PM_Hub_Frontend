export type MetricTone =
  | 'blue'
  | 'teal'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'amber'
  | 'neutral'
  | '';

export interface DashboardMetric {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: MetricTone;
}
