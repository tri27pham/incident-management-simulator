import { Incident, IncidentSeverity } from '../types';
import { BackendIncident, IncidentWithAnalysis } from './api';

// Map backend severity to frontend severity
function mapSeverity(backendSeverity?: string): IncidentSeverity | undefined {
  if (!backendSeverity) return undefined;
  
  const severityMap: Record<string, IncidentSeverity> = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'minor': 'minor',
  };
  
  return severityMap[backendSeverity.toLowerCase()] || 'minor';
}

// Convert backend incident to frontend format
export function mapBackendIncidentToFrontend(
  backendIncident: BackendIncident | IncidentWithAnalysis
): Incident {
  const analysis = 'analysis' in backendIncident ? backendIncident.analysis : undefined;
  
  // Calculate time elapsed
  const createdAt = new Date(backendIncident.created_at);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let timeElapsed: string;
  if (diffDays > 0) {
    timeElapsed = `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    timeElapsed = `${diffHours}h ${diffMins % 60}m`;
  } else {
    timeElapsed = `${diffMins}m`;
  }
  
  // Extract team from source (e.g., "billing-service" -> "Billing")
  const team = backendIncident.source
    ? backendIncident.source.split('-')[0].charAt(0).toUpperCase() + 
      backendIncident.source.split('-')[0].slice(1)
    : 'Unknown';
  
  // Check if diagnosis is valid (not an error message)
  const hasValidDiagnosis = analysis?.diagnosis && 
                           !analysis.diagnosis.includes('error') && 
                           !analysis.diagnosis.includes('Error') &&
                           !analysis.diagnosis.startsWith('{');
  
  // Check if solution is valid (not an error message)
  const hasValidSolution = analysis?.solution && 
                          !analysis.solution.includes('error') && 
                          !analysis.solution.includes('Error') &&
                          !analysis.solution.startsWith('{');
  
  return {
    id: backendIncident.id,
    incidentNumber: `INC-${backendIncident.id.slice(0, 4).toUpperCase()}`,
    title: backendIncident.message,
    timeElapsed,
    severity: analysis ? mapSeverity(analysis.severity) : undefined,
    team,
    description: hasValidDiagnosis ? analysis.diagnosis : undefined,
    impact: analysis && hasValidDiagnosis ? `Confidence: ${(analysis.confidence * 100).toFixed(0)}%` : undefined,
    affectedServices: backendIncident.source ? [backendIncident.source] : [],
    assignee: undefined,
    createdAt: new Date(backendIncident.created_at).toLocaleString(),
    lastUpdate: new Date(backendIncident.updated_at).toLocaleString(),
    diagnosis: hasValidDiagnosis ? analysis.diagnosis : undefined,
    solution: hasValidSolution ? analysis.solution : undefined,
    hasDiagnosis: hasValidDiagnosis || false,
    hasSolution: hasValidSolution || false,
  };
}

// Map frontend status to backend status
export function mapFrontendStatusToBackend(status: string): string {
  const statusMap: Record<string, string> = {
    'Triage': 'triage',
    'Investigating': 'investigating',
    'Fixing': 'fixing',
  };
  return statusMap[status] || 'triage';
}

// Map backend status to frontend status
export function mapBackendStatusToFrontend(status: string): 'Triage' | 'Investigating' | 'Fixing' {
  const statusMap: Record<string, 'Triage' | 'Investigating' | 'Fixing'> = {
    'triage': 'Triage',
    'investigating': 'Investigating',
    'fixing': 'Fixing',
    'resolved': 'Fixing', // Treat resolved as fixing for now
  };
  return statusMap[status] || 'Triage';
}

