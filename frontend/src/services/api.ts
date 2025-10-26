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

// WebSocket connection
export function connectWebSocket(onMessage: (data: IncidentWithAnalysis) => void): WebSocket {
  const wsUrl = API_BASE_URL.replace('http', 'ws').replace('/api/v1', '') + '/api/v1/ws';
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket connected to:', wsUrl);
    console.log('✅ WebSocket readyState:', ws.readyState);
  };

  ws.onmessage = (event) => {
    console.log('📨 Raw WebSocket message received:', event.data);
    try {
      const data = JSON.parse(event.data);
      console.log('📦 Parsed WebSocket data:', {
        id: data.id?.substring(0, 8),
        message: data.message?.substring(0, 50),
        status: data.status,
        hasAnalysis: !!data.analysis
      });
      onMessage(data);
      console.log('✅ onMessage callback completed');
    } catch (error) {
      console.error('❌ Failed to parse or process WebSocket message:', error);
      console.error('❌ Event data was:', event.data);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    console.error('❌ WebSocket readyState:', ws.readyState);
  };

  ws.onclose = (event) => {
    console.log('🔌 WebSocket disconnected');
    console.log('🔌 Close code:', event.code);
    console.log('🔌 Close reason:', event.reason);
    console.log('🔌 Was clean:', event.wasClean);
  };

  return ws;
}

