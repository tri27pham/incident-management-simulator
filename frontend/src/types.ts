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
  // Agent classification fields
  incidentType?: 'real_system' | 'synthetic' | 'training';
  actionable?: boolean;
  affectedSystems?: string[];
  remediationMode?: 'automated' | 'manual' | 'advisory';
  metadata?: Record<string, any>;
  // Agent execution data
  agentExecutions?: AgentExecution[];
}

export type AgentExecutionStatus = 
  | 'thinking' 
  | 'previewing' 
  | 'awaiting_approval' 
  | 'executing' 
  | 'verifying' 
  | 'completed' 
  | 'failed';

export interface AgentCommand {
  name: string;
  command: string;
  args: string[];
  target: string;
  description: string;
}

export interface AgentRisk {
  level: string;
  description: string;
  mitigation: string;
}

export interface ExecutionLog {
  timestamp: string;
  command: string;
  status: string;
  output: string;
  error_detail?: string;
  duration_ms: number;
}

export interface VerificationCheck {
  check_name: string;
  description: string;
  passed: boolean;
  result: string;
  expected: string;
}

export interface AgentExecution {
  id: string;
  incident_id: string;
  status: AgentExecutionStatus;
  agent_model: string;
  analysis?: string;
  recommended_action?: string;
  reasoning?: string;
  commands?: AgentCommand[];
  risks?: AgentRisk[];
  estimated_impact?: string;
  execution_logs?: ExecutionLog[];
  verification_checks?: VerificationCheck[];
  verification_passed?: boolean;
  verification_notes?: string;
  success?: boolean;
  error_message?: string;
  rollback_performed?: boolean;
  dry_run: boolean;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
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
