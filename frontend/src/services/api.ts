const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export interface BackendStatusHistory {
  id: string;
  incident_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

export interface BackendIncident {
  id: string;
  message: string;
  source: string;
  status: 'triage' | 'investigating' | 'fixing' | 'resolved';
  generated_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  status_history?: BackendStatusHistory[];
  // Agent classification fields
  incident_type?: 'real_system' | 'synthetic' | 'training';
  actionable?: boolean;
  affected_systems?: string[];
  remediation_mode?: 'automated' | 'manual' | 'advisory';
  metadata?: Record<string, any>;
}

export interface IncidentAnalysis {
  id: string;
  incident_id: string;
  severity: string;
  diagnosis: string;
  diagnosis_provider?: string;
  solution: string;
  solution_provider?: string;
  confidence: number;
  created_at: string;
}

export interface IncidentWithAnalysis extends BackendIncident {
  analysis?: IncidentAnalysis;
}

// Fetch all incidents (excluding resolved)
export async function fetchIncidents(): Promise<BackendIncident[]> {
  const response = await fetch(`${API_BASE_URL}/incidents`);
  if (!response.ok) {
    throw new Error('Failed to fetch incidents');
  }
  return response.json();
}

// Fetch resolved incidents
export async function fetchResolvedIncidents(): Promise<BackendIncident[]> {
  const response = await fetch(`${API_BASE_URL}/incidents/resolved`);
  if (!response.ok) {
    throw new Error('Failed to fetch resolved incidents');
  }
  return response.json();
}

// Create a new incident
export async function createIncident(incident: { message: string; source: string }): Promise<BackendIncident> {
  const response = await fetch(`${API_BASE_URL}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(incident),
  });
  if (!response.ok) {
    throw new Error('Failed to create incident');
  }
  return response.json();
}

// Update incident status
export async function updateIncidentStatus(id: string, status: string): Promise<BackendIncident> {
  const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error('Failed to update incident');
  }
  return response.json();
}

// Update incident notes
export async function updateIncidentNotes(id: string, notes: string): Promise<BackendIncident> {
  const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) {
    throw new Error('Failed to update incident notes');
  }
  return response.json();
}

// Trigger AI diagnosis
export async function triggerDiagnosis(id: string): Promise<IncidentAnalysis> {
  const response = await fetch(`${API_BASE_URL}/incidents/${id}/diagnose`, {
    method: 'POST',
  });
  if (!response.ok) {
    // Try to extract error message from response
    let errorMessage = 'Failed to trigger diagnosis';
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      // If JSON parsing fails, use default message
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// Trigger AI suggested fix
export async function triggerSuggestedFix(id: string): Promise<IncidentAnalysis> {
  const response = await fetch(`${API_BASE_URL}/incidents/${id}/suggest-fix`, {
    method: 'POST',
  });
  if (!response.ok) {
    // Try to extract error message from response
    let errorMessage = 'Failed to trigger suggested fix';
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      // If JSON parsing fails, use default message
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// Generate a random incident
export async function generateRandomIncident(): Promise<BackendIncident> {
  const response = await fetch(`${API_BASE_URL}/incidents/generate`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to generate incident');
  }
  return response.json();
}

// Generator control API
const GENERATOR_URL = import.meta.env.VITE_GENERATOR_URL || 'http://localhost:9000';

export async function startGenerator(): Promise<void> {
  const response = await fetch(`${GENERATOR_URL}/api/start`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to start generator');
  }
}

export async function stopGenerator(): Promise<void> {
  const response = await fetch(`${GENERATOR_URL}/api/stop`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to stop generator');
  }
}

export async function getGeneratorStatus(): Promise<{ is_running: boolean }> {
  const response = await fetch(`${GENERATOR_URL}/api/status`);
  if (!response.ok) {
    throw new Error('Failed to get generator status');
  }
  return response.json();
}

// Health Monitor API - Trigger failures
const HEALTH_MONITOR_URL = import.meta.env.VITE_HEALTH_MONITOR_URL || 'http://localhost:8002';

export async function clearRedis(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/clear/redis`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to clear Redis');
  }
  return response.json();
}

export async function triggerRedisMemoryFailure(): Promise<{ status: string; message: string; health: number }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/trigger/redis-memory`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to trigger Redis memory failure');
  }
  return response.json();
}

export async function clearPostgres(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/clear/postgres`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to clear PostgreSQL connections');
  }
  return response.json();
}

export async function triggerPostgresConnectionFailure(): Promise<{ status: string; message: string; health: number }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/trigger/postgres-connections`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to trigger PostgreSQL connection failure');
  }
  return response.json();
}

export async function triggerPostgresBloat(): Promise<{ status: string; message: string; health: number }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/trigger/postgres-bloat`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to trigger PostgreSQL bloat');
  }
  return response.json();
}

export async function clearPostgresBloat(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/clear/postgres-bloat`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to clear PostgreSQL bloat');
  }
  return response.json();
}

export async function triggerDiskFull(): Promise<{ status: string; message: string; health: number }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/trigger/disk-full`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to trigger disk full');
  }
  return response.json();
}

export async function clearDisk(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/clear/disk`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to clear disk space');
  }
  return response.json();
}

export async function getHealthMonitorStatus(): Promise<{
  services: {
    'redis-test': {
      health: number;
      memory_used: number;
      memory_max: number;
      memory_percent: number;
      status: string;
      will_trigger_incident: boolean;
    };
    'postgres-test'?: {
      health: number;
      idle_connections: number;
      active_connections: number;
      total_connections: number;
      max_connections: number;
      idle_ratio: number;
      status: string;
      will_trigger_incident: boolean;
    };
    'postgres-bloat'?: {
      health: number;
      dead_tuples: number;
      live_tuples: number;
      dead_ratio: number;
      status: string;
      will_trigger_incident: boolean;
    };
    'disk-space'?: {
      health: number;
      used_percent: number;
      used_mb: number;
      free_mb: number;
      total_mb: number;
      status: string;
      will_trigger_incident: boolean;
    };
  };
  last_check: string;
}> {
  const response = await fetch(`${HEALTH_MONITOR_URL}/status`);
  if (!response.ok) {
    throw new Error('Failed to get health monitor status');
  }
  return response.json();
}

// WebSocket connection
export function connectWebSocket(onMessage: (data: IncidentWithAnalysis) => void): WebSocket {
  const wsUrl = API_BASE_URL.replace('http', 'ws').replace('/api/v1', '') + '/api/v1/ws';
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  // Don't set onclose here - let the caller handle reconnection logic

  return ws;
}

// --- AI Agent Remediation API ---

export interface AgentExecutionResponse {
  id: string;
  incident_id: string;
  status: string;
  agent_model: string;
  analysis?: string;
  recommended_action?: string;
  reasoning?: string;
  commands?: any;
  risks?: any;
  estimated_impact?: string;
  execution_logs?: any;
  verification_checks?: any;
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

export async function startAgentRemediation(incidentId: string): Promise<AgentExecutionResponse> {
  const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}/agent/remediate`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start agent remediation');
  }
  return response.json();
}

export async function getAgentExecution(executionId: string): Promise<AgentExecutionResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/executions/${executionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch agent execution');
  }
  return response.json();
}

export async function getIncidentAgentExecutions(incidentId: string): Promise<AgentExecutionResponse[]> {
  const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}/agent/executions`);
  if (!response.ok) {
    throw new Error('Failed to fetch agent executions');
  }
  return response.json();
}

export async function approveAgentExecution(executionId: string): Promise<AgentExecutionResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/executions/${executionId}/approve`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to approve agent execution');
  }
  return response.json();
}

export async function rejectAgentExecution(executionId: string): Promise<AgentExecutionResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/executions/${executionId}/reject`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reject agent execution');
  }
  return response.json();
}

