export interface KpiMetric {
  id: string;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isUp: boolean;
  };
}

export interface SubmissionsByDate {
  date: string;
  submissions: number;
}

export interface SubmissionsByRep {
  name: string;
  submissions: number;
  deals: number;
  calls: number;
}

export interface CallDurationDistribution {
  label: string;
  count: number;
  percentage: string;
  color: string;
}

export interface HeatmapRow {
  day: string;
  hours: { [hour: number]: number };
  total: number;
}

export interface RepresentativeOption {
  id: string;
  Representative: string;
  Type: string;
}
