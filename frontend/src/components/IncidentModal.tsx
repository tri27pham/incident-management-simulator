import { useState } from 'react';
import { Incident } from '../types';
import { triggerSuggestedFix } from '../services/api';

interface IncidentModalProps {
  incident: Incident;
  onClose: () => void;
  onSolutionUpdate: (id: string, solution: string) => void;
}

const severityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800' },
  minor: { label: 'Minor', color: 'bg-gray-100 text-gray-800' },
};

export function IncidentModal({ incident, onClose, onSolutionUpdate }: IncidentModalProps) {
  const severity = incident.severity ? severityConfig[incident.severity] : null;
  const [isGettingSolution, setIsGettingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  const handleGetSolution = async () => {
    setIsGettingSolution(true);
    setSolutionError(null);
    
    try {
      const analysis = await triggerSuggestedFix(incident.id);
      
      // Check if the response is an error message
      const isErrorMessage = 
        analysis.solution.startsWith('Failed to') ||
        analysis.solution.startsWith('Error:') ||
        analysis.solution.startsWith('Cannot') ||
        analysis.solution.includes('Unable to generate') ||
        analysis.solution.includes('AI service returned') ||
        analysis.solution.includes('Gemini API') ||
        analysis.solution.includes('Network error') ||
        analysis.solution.includes('invalid response');
      
      if (isErrorMessage) {
        setSolutionError(analysis.solution);
      } else if (analysis.solution && analysis.solution.length > 10) {
        onSolutionUpdate(incident.id, analysis.solution);
      } else {
        setSolutionError('Failed to get solution. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to get solution:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection.';
      setSolutionError(errorMessage);
    } finally {
      setIsGettingSolution(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: `rgb(var(--bg-secondary))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between" style={{ 
          backgroundColor: `rgb(var(--bg-tertiary))`,
          borderBottom: `1px solid rgb(var(--border-color))`
        }}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-secondary">{incident.incidentNumber}</span>
              {severity && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${severity.color}`}>
                  {severity.label}
                </span>
              )}
              <span className="text-sm text-tertiary">•</span>
              <span className="text-sm text-secondary">{incident.timeElapsed}</span>
            </div>
            <h2 className="text-2xl font-semibold text-primary">{incident.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none ml-4 transition-colors text-tertiary hover:text-secondary"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Affected Services */}
              {incident.affectedServices && incident.affectedServices.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-2">Affected Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {incident.affectedServices.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="diagnosis-box rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="diagnosis-title text-sm font-semibold">AI Diagnosis</h3>
                      {incident.diagnosisProvider && incident.diagnosisProvider !== 'unknown' && incident.diagnosisProvider !== 'error' && (
                        <span 
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                            incident.diagnosisProvider === 'gemini' 
                              ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                              : 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                          }`}
                          title={`Generated by ${incident.diagnosisProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                        >
                          {incident.diagnosisProvider === 'gemini' ? '✨ Gemini' : '⚡ Groq'}
                        </span>
                      )}
                    </div>
                    <div className="max-h-32 overflow-y-auto pr-2" style={{ 
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgb(var(--border-color)) transparent'
                    }}>
                      <p className="diagnosis-text text-sm leading-relaxed">
                        {incident.description || 'Awaiting AI diagnosis...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Solution Section */}
              <div>
                {incident.hasSolution && incident.solution ? (
                  <div className="solution-box rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="solution-title text-sm font-semibold">Suggested Solution</h4>
                          {incident.solutionProvider && incident.solutionProvider !== 'unknown' && incident.solutionProvider !== 'error' && (
                            <span 
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                incident.solutionProvider === 'gemini' 
                                  ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                                  : 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                              }`}
                              title={`Generated by ${incident.solutionProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                            >
                              {incident.solutionProvider === 'gemini' ? '✨ Gemini' : '⚡ Groq'}
                            </span>
                          )}
                          {incident.confidence !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {(incident.confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                        <div className="max-h-32 overflow-y-auto pr-2" style={{ 
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgb(var(--border-color)) transparent'
                        }}>
                          <p className="solution-text text-sm leading-relaxed">{incident.solution}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : incident.hasDiagnosis && !isGettingSolution ? (
                  <div>
                    <button
                      onClick={handleGetSolution}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Get AI Solution
                    </button>
                    {solutionError && (
                      <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-600">{solutionError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isGettingSolution ? (
                  <div className="flex items-center justify-center py-6">
                    <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-sm text-secondary">Getting AI solution...</span>
                  </div>
                ) : (
                  <p className="text-sm text-tertiary text-center py-4">
                    AI diagnosis needed before generating solution
                  </p>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Status</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                    incident.status === 'Triage' ? 'bg-blue-100 text-blue-800' :
                    incident.status === 'Investigating' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {incident.status}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Team</span>
                  <span className="text-sm font-medium text-primary flex items-center gap-1">
                    <span className="text-tertiary">⬢⬢</span>
                    {incident.team}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Assignee</span>
                  <span className="text-sm font-medium text-primary">
                    {incident.assignee || 'Unassigned'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Created</span>
                  <span className="text-sm font-medium text-primary">
                    {incident.createdAt || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">Last Update</span>
                  <span className="text-sm font-medium text-primary">
                    {incident.lastUpdate || 'No updates'}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 text-primary">Timeline</h3>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2" style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgb(var(--border-color)) transparent'
                }}>
                  {/* Timeline with vertical line */}
                  <div className="relative">
                    {/* Vertical connecting line */}
                    <div 
                      className="absolute left-1 top-2 bottom-2 w-px" 
                      style={{ backgroundColor: `rgb(var(--border-color))` }}
                    ></div>
                    
                    <div className="space-y-3">
                      {/* Incident Created */}
                      <div className="flex gap-3 relative">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 relative z-10" style={{ backgroundColor: '#3B82F6' }}></div>
                        <div>
                          <p className="text-sm font-medium text-primary">Incident created</p>
                          <p className="text-xs text-secondary">{incident.createdAt || 'Unknown'}</p>
                        </div>
                      </div>

                      {/* Status History - shows all status changes */}
                      {incident.statusHistory && incident.statusHistory.length > 0 && 
                        incident.statusHistory.map((entry, index) => {
                          const isCurrentStatus = index === incident.statusHistory!.length - 1;
                          return (
                            <div key={index} className="flex gap-3 relative">
                              <div 
                                className="w-2 h-2 rounded-full mt-1.5 relative z-10"
                                style={{ 
                                  backgroundColor: entry.status === 'Triage' ? '#3B82F6' :
                                                   entry.status === 'Investigating' ? '#F97316' :
                                                   '#EF4444'
                                }}
                              ></div>
                              <div>
                                <p className="text-sm font-medium text-primary">
                                  {isCurrentStatus ? 'Current: ' : 'Status changed to '}{entry.status}
                                </p>
                                <p className="text-xs text-secondary">{entry.timestamp}</p>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 mt-6" style={{ borderTop: `1px solid rgb(var(--border-color))` }}>
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: `rgb(var(--accent-primary))`,
                  color: 'white',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--accent-hover))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--accent-primary))`}
              >
                Update Status
              </button>
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium text-primary transition-colors border-theme"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderWidth: '1px',
                  borderColor: `rgb(var(--border-color))`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`}
              >
                Add Update
              </button>
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium text-primary transition-colors border-theme"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderWidth: '1px',
                  borderColor: `rgb(var(--border-color))`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

