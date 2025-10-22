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
  created_at: string;
  updated_at: string;
  status_history?: BackendStatusHistory[];
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

// Fetch all incidents
export async function fetchIncidents(): Promise<BackendIncident[]> {
  const response = await fetch(`${API_BASE_URL}/incidents`);
  if (!response.ok) {
    throw new Error('Failed to fetch incidents');
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

  ws.onclose = () => {
    console.log('❌ WebSocket disconnected');
  };

  return ws;
}

