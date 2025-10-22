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
  
  // Check for garbage patterns in text
  const hasGarbagePatterns = (text?: string) => {
    if (!text) return false; // Empty text is not garbage, just missing
    const garbageIndicators = [
      'externalActionCode', 'BuilderFactory', 'visitInsn', 'roscope',
      'RODUCTION', 'slider', 'Injected', 'contaminants', 'exposition', 'Basel'
    ];
    const garbageCount = garbageIndicators.filter(indicator => text.includes(indicator)).length;
    return garbageCount > 2;
  };
  
  // Check if diagnosis is valid (not an error message or garbage)
  let hasValidDiagnosis = false;
  if (analysis?.diagnosis) {
    const text = analysis.diagnosis;
    // Check for ERROR MESSAGES (not diagnoses that mention errors as symptoms)
    const isErrorMessage = 
      text.startsWith('Failed to') ||
      text.startsWith('Error:') ||
      text.startsWith('Cannot') ||
      text.includes('Unable to generate') ||
      text.includes('AI service returned') ||
      text.includes('Gemini API rate limit') ||
      text.includes('Gemini API quota') ||
      text.includes('Gemini API is currently') ||
      text.includes('Network error') ||
      text.includes('invalid response') ||
      text.startsWith('{');
    
    const checks = {
      exists: !!text,
      lengthOk: text.length > 10,
      notErrorMessage: !isErrorMessage,
      noGarbage: !hasGarbagePatterns(text)
    };
    
    hasValidDiagnosis = checks.exists && checks.lengthOk && checks.notErrorMessage && checks.noGarbage;
    
    console.log(`[Mapper] Diagnosis validation for ${backendIncident.id.slice(0, 8)}:`, checks, `→ hasValidDiagnosis=${hasValidDiagnosis}`);
  } else {
    console.log(`[Mapper] No diagnosis for ${backendIncident.id.slice(0, 8)}`);
  }
  
  // Check if solution is valid (not an error message or garbage)
  let hasValidSolution = false;
  if (analysis?.solution) {
    const text = analysis.solution;
    const isErrorMessage = 
      text.startsWith('Failed to') ||
      text.startsWith('Error:') ||
      text.startsWith('Cannot') ||
      text.includes('Unable to generate') ||
      text.includes('AI service returned') ||
      text.includes('Gemini API rate limit') ||
      text.includes('Gemini API quota') ||
      text.includes('Gemini API is currently') ||
      text.includes('Network error') ||
      text.includes('invalid response') ||
      text.startsWith('{');
    
    hasValidSolution = text.length > 10 && !isErrorMessage && !hasGarbagePatterns(text);
  }
  
  // Debug logging (can be removed later)
  if (analysis) {
    console.log(`[Mapper] Incident ${backendIncident.id.slice(0, 8)}:`, {
      hasDiagnosisField: !!analysis.diagnosis,
      diagnosisLength: analysis.diagnosis?.length || 0,
      diagnosisPreview: analysis.diagnosis?.slice(0, 50),
      hasValidDiagnosis,
      hasSolutionField: !!analysis.solution,
      solutionLength: analysis.solution?.length || 0,
      hasValidSolution
    });
  }
  
  // Map status history from backend
  const statusHistory = backendIncident.status_history?.map(entry => ({
    status: mapBackendStatusToFrontend(entry.to_status),
    timestamp: new Date(entry.changed_at).toLocaleString(),
  })) || [];

  const mappedIncident = {
    id: backendIncident.id,
    incidentNumber: `INC-${backendIncident.id.slice(0, 4).toUpperCase()}`,
    title: backendIncident.message,
    timeElapsed,
    status: mapBackendStatusToFrontend(backendIncident.status),
    severity: analysis ? mapSeverity(analysis.severity) : undefined,
    team,
    description: hasValidDiagnosis && analysis ? analysis.diagnosis : undefined, // Diagnosis IS the description
    affectedServices: backendIncident.source ? [backendIncident.source] : [],
    assignee: undefined,
    createdAt: new Date(backendIncident.created_at).toLocaleString(),
    lastUpdate: new Date(backendIncident.updated_at).toLocaleString(),
    diagnosis: hasValidDiagnosis && analysis ? analysis.diagnosis : undefined,
    diagnosisProvider: analysis?.diagnosis_provider as 'gemini' | 'groq' | 'error' | 'unknown' | undefined,
    solution: hasValidSolution && analysis ? analysis.solution : undefined,
    solutionProvider: analysis?.solution_provider as 'gemini' | 'groq' | 'error' | 'unknown' | undefined,
    confidence: analysis?.confidence,
    hasDiagnosis: hasValidDiagnosis,
    hasSolution: hasValidSolution,
    generated_by: backendIncident.generated_by as 'gemini' | 'groq' | 'fallback' | 'manual' | undefined,
    statusHistory,
    timeline: statusHistory, // Also provide as timeline for resolved panel
  };
  
  console.log(`[Mapper] Final incident ${backendIncident.id.slice(0, 8)}:`, {
    hasDiagnosis: mappedIncident.hasDiagnosis,
    hasSolution: mappedIncident.hasSolution,
    diagnosisSet: !!mappedIncident.diagnosis,
    solutionSet: !!mappedIncident.solution
  });
  
  return mappedIncident;
}

// Map frontend status to backend status
export function mapFrontendStatusToBackend(status: string): string {
  const statusMap: Record<string, string> = {
    'Triage': 'triage',
    'Investigating': 'investigating',
    'Fixing': 'fixing',
    'Resolved': 'resolved',
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

