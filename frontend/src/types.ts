export type IncidentStatus = 'Triage' | 'Investigating' | 'Fixing';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'minor';

export interface Incident {
  id: string;
  incidentNumber: string;
  title: string;
  timeElapsed: string;
  severity?: IncidentSeverity;
  team: string;
  avatarUrl?: string;
}

export type IncidentBoardState = {
  [key in IncidentStatus]: {
    name: IncidentStatus;
    items: Incident[];
  };
};

export interface TrendMetric {
  label: string;
  value: string;
  change: number;
  isPositive: boolean;
}
