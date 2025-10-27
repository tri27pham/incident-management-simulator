import { useState, useRef, useEffect } from 'react';
import { Incident } from '../types';
import { triggerSuggestedFix, updateIncidentNotes } from '../services/api';
import AgentWorkflow from './AgentWorkflow';

interface IncidentModalProps {
  incident: Incident;
  onClose: () => void;
  onSolutionUpdate: (id: string, solution: string) => void;
  onStatusUpdate?: (id: string, newStatus: string) => void;
}

const severityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800' },
  minor: { label: 'Minor', color: 'bg-gray-100 text-gray-800' },
};

// Helper component to format bullet points
function FormattedText({ text, className }: { text: string; className?: string }) {
  // Split by bullet points (•) and filter out empty strings
  const lines = text.split('•').map(line => line.trim()).filter(line => line.length > 0);
  
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <div key={index} className="flex gap-2 mb-2 last:mb-0">
          <span className="shrink-0 mt-0.5">•</span>
          <span className="flex-1">{line}</span>
        </div>
      ))}
    </div>
  );
}

export function IncidentModal({ incident, onClose, onSolutionUpdate, onStatusUpdate }: IncidentModalProps) {
  const severity = incident.severity ? severityConfig[incident.severity] : null;
  const [isGettingSolution, setIsGettingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(incident.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  // Get available status options (exclude current status, add Resolved for Fixing)
  const getAvailableStatuses = () => {
    const allStatuses = ['Triage', 'Investigating', 'Fixing'];
    const statuses = allStatuses.filter(status => status !== incident.status);
    
    // Add "Resolved" option if incident is in Fixing status
    if (incident.status === 'Fixing') {
      statuses.push('Resolved');
    }
    
    return statuses;
  };

  const availableStatuses = getAvailableStatuses();

  // Get icon for each status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Triage':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'Investigating':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'Fixing':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'Resolved':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };

    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showStatusDropdown]);

  const handleStatusChange = async (newStatus: string) => {
    setShowStatusDropdown(false);
    if (onStatusUpdate) {
      onStatusUpdate(incident.id, newStatus);
    }
  };

  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setHasUnsavedNotes(true);
    setNotesSaved(false);
  };

  // Handle save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    setNotesSaved(false);
    
    try {
      await updateIncidentNotes(incident.id, notes);
      setHasUnsavedNotes(false);
      setNotesSaved(true);
      
      // Hide "Saved!" message after 2 seconds
      setTimeout(() => {
        setNotesSaved(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

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
        className="rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: `rgb(var(--card-bg))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between" style={{ 
          backgroundColor: `rgb(var(--bg-secondary))`,
          borderBottom: `1px solid rgb(var(--border-color))`
        }}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-sm font-medium text-secondary">{incident.incidentNumber}</span>
              {severity && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${severity.color}`}>
                  {severity.label}
                </span>
              )}
              {/* Agent classification badges - full labels */}
              {incident.actionable && incident.incidentType === 'real_system' && (
                <span 
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'white' }}
                >
                  <span>🤖</span>
                  <span>Agent Ready</span>
                </span>
              )}
              {incident.incidentType === 'synthetic' && (
                <span 
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: 'rgb(168, 85, 247)', color: 'white' }}
                >
                  <span>📝</span>
                  <span>Synthetic</span>
                </span>
              )}
              {incident.incidentType === 'training' && (
                <span 
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: 'rgb(59, 130, 246)', color: 'white' }}
                >
                  <span>🎓</span>
                  <span>Training</span>
                </span>
              )}
              {incident.remediationMode === 'manual' && (
                <span 
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: 'rgb(234, 88, 12)', color: 'white' }}
                >
                  <span>👤</span>
                  <span>Manual Only</span>
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
        <div className="px-6 py-6 overflow-hidden" style={{ height: 'calc(90vh - 240px)' }}>
          <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
            {/* Left Column */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Affected Services */}
              {incident.affectedServices && incident.affectedServices.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <h3 className="text-sm font-semibold text-primary whitespace-nowrap">Affected Services:</h3>
                  <div className="flex flex-wrap gap-2">
                    {incident.affectedServices.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: 'rgb(249, 115, 22)', color: 'white' }}
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <div className="diagnosis-box rounded-lg py-4 pr-4 pl-3 h-full overflow-hidden">
                  <div className="flex items-start gap-3 h-full">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 min-w-0 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2 shrink-0">
                        <h3 className="diagnosis-title text-sm font-semibold">AI Diagnosis</h3>
                        {incident.diagnosisProvider && incident.diagnosisProvider !== 'unknown' && incident.diagnosisProvider !== 'error' && (
                          <span 
                            className="text-[10px] pl-1.5 pr-2 py-0.5 rounded font-semibold"
                            style={{ backgroundColor: 'rgb(var(--bg-tertiary))', color: 'white' }}
                            title={`Generated by ${incident.diagnosisProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                          >
                            {incident.diagnosisProvider === 'gemini' ? '✨ Gemini' : '⚡ Groq'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-scroll pr-2 min-h-0" style={{ 
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgb(var(--border-color)) transparent'
                      }}>
                        {incident.description ? (
                          <FormattedText text={incident.description} className="diagnosis-text text-sm leading-relaxed" />
                        ) : (
                          <p className="diagnosis-text text-sm leading-relaxed">Awaiting AI diagnosis...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Solution Section */}
              <div className="flex-1 min-h-0">
                {incident.hasSolution && incident.solution ? (
                  <div className="solution-box rounded-lg py-4 pr-4 pl-3 h-full overflow-hidden">
                    <div className="flex items-start gap-3 h-full">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <div className="flex-1 min-w-0 h-full flex flex-col">
                        <div className="flex items-center gap-2 mb-2 shrink-0">
                          <h4 className="solution-title text-sm font-semibold">Suggested Solution</h4>
                          {incident.solutionProvider && incident.solutionProvider !== 'unknown' && incident.solutionProvider !== 'error' && (
                            <span 
                              className="text-[10px] pl-1.5 pr-2 py-0.5 rounded font-semibold"
                              style={{ backgroundColor: 'rgb(var(--bg-tertiary))', color: 'white' }}
                              title={`Generated by ${incident.solutionProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                            >
                              {incident.solutionProvider === 'gemini' ? '✨ Gemini' : '⚡ Groq'}
                            </span>
                          )}
                          {incident.confidence !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border" style={{ borderColor: 'rgb(249, 115, 22)', color: 'rgb(249, 115, 22)', backgroundColor: 'transparent' }}>
                              {(incident.confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                        <div className="flex-1 overflow-y-scroll pr-2 min-h-0" style={{ 
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgb(var(--border-color)) transparent'
                        }}>
                          <FormattedText text={incident.solution} className="solution-text text-sm leading-relaxed" />
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
            <div className="flex flex-col gap-4 min-h-0 overflow-y-auto" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(var(--border-color)) transparent'
            }}>
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

              {/* Notes Section */}
              <div>
                <h3 className="text-sm font-semibold mb-2 text-primary">Notes</h3>
                <div className="rounded-lg p-4" style={{ 
                  backgroundColor: `rgb(var(--bg-tertiary))`,
                  borderColor: `rgb(var(--border-color))`,
                  border: `1px solid rgb(var(--border-color))`
                }}>
                  <textarea
                    value={notes}
                    onChange={handleNotesChange}
                    placeholder="Add notes about this incident..."
                    className="w-full bg-transparent resize-none text-sm text-primary placeholder-tertiary focus:outline-none mb-3"
                    style={{
                      minHeight: '120px',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgb(var(--border-color)) transparent'
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleSaveNotes}
                      disabled={!hasUnsavedNotes || isSavingNotes}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: hasUnsavedNotes ? 'rgb(249, 115, 22)' : `rgb(var(--bg-secondary))`,
                        color: hasUnsavedNotes ? 'white' : `rgb(var(--text-secondary))`,
                        border: `1px solid ${hasUnsavedNotes ? 'rgb(249, 115, 22)' : 'rgb(var(--border-color))'}`,
                      }}
                    >
                      {isSavingNotes ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Save Notes
                        </>
                      )}
                    </button>
                    {notesSaved && (
                      <span className="text-sm flex items-center gap-1" style={{ color: 'rgb(34, 197, 94)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Agent Remediation Section */}
              {incident.actionable && incident.incidentType === 'real_system' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-primary">AI Agent Remediation</h3>
                    <span 
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'white' }}
                    >
                      🤖 Automated
                    </span>
                  </div>
                  <AgentWorkflow 
                    incidentId={incident.id} 
                    canAgentAct={incident.actionable === true && incident.incidentType === 'real_system'}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4" style={{ borderTop: `1px solid rgb(var(--border-color))` }}>
            <div className="flex gap-3">
              {/* Update Status Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: `rgb(var(--accent-primary))`,
                    color: 'white',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--accent-hover))`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--accent-primary))`}
                >
                  Update Status
                  <svg 
                    className={`w-4 h-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu - Opens Upward */}
                {showStatusDropdown && availableStatuses.length > 0 && (
                  <div 
                    className="absolute bottom-full left-0 mb-2 rounded-lg shadow-lg border overflow-hidden z-50"
                    style={{
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      minWidth: '180px'
                    }}
                  >
                    {availableStatuses.map((status) => {
                      const isResolved = status === 'Resolved';
                      return (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2.5 ${
                            isResolved ? 'text-white' : 'text-primary'
                          }`}
                          style={{
                            backgroundColor: isResolved ? '#10B981' : `rgb(var(--bg-secondary))`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isResolved ? '#059669' : `rgb(var(--bg-tertiary))`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isResolved ? '#10B981' : `rgb(var(--bg-secondary))`;
                          }}
                        >
                          {getStatusIcon(status)}
                          <span>{status}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
  );
}

