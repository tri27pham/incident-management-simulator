export type IncidentStatus = 'Triage' | 'Investigating' | 'Fixing';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'minor';

export interface StatusHistoryEntry {
  status: IncidentStatus | 'Resolved';
  timestamp: string;
}

export interface Incident {
  id: string;
  incidentNumber: string;
  title: string;
  timeElapsed: string;
  status: IncidentStatus;
  severity?: IncidentSeverity;
  team: string;
  avatarUrl?: string;
  description?: string;
  impact?: string;
  affectedServices?: string[];
  assignee?: string;
  createdAt?: string;
  lastUpdate?: string;
  diagnosis?: string;
  diagnosisProvider?: 'gemini' | 'groq' | 'error' | 'unknown';
  solution?: string;
  solutionProvider?: 'gemini' | 'groq' | 'error' | 'unknown';
  confidence?: number;
  hasDiagnosis?: boolean;
  hasSolution?: boolean;
  generated_by?: 'gemini' | 'groq' | 'fallback' | 'manual';
  statusHistory?: StatusHistoryEntry[];
  timeline?: StatusHistoryEntry[]; // Alias for statusHistory for resolved panel
  notes?: string;
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
