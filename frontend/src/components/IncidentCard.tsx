import { Draggable } from 'react-beautiful-dnd';
import { Incident } from '../types';
import { useState, useEffect, useRef } from 'react';
import { triggerDiagnosis, triggerSuggestedFix } from '../services/api';

const severityConfig = {
  high: { 
    label: 'High', 
    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
    color: 'rgb(239, 68, 68)', 
    borderColor: 'rgb(239, 68, 68)',
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  medium: { 
    label: 'Medium', 
    backgroundColor: 'rgba(249, 115, 22, 0.1)', 
    color: 'rgb(249, 115, 22)', 
    borderColor: 'rgb(249, 115, 22)',
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  low: { 
    label: 'Low', 
    backgroundColor: 'rgba(234, 179, 8, 0.1)', 
    color: 'rgb(234, 179, 8)', 
    borderColor: 'rgb(234, 179, 8)',
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  undiagnosed: { 
    label: 'Undiagnosed', 
    backgroundColor: 'rgba(156, 163, 175, 0.1)', 
    color: 'rgb(156, 163, 175)', 
    borderColor: 'rgb(156, 163, 175)',
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
};

interface IncidentCardProps {
  item: Incident;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenModal: (incident: Incident) => void;
  onDiagnosisUpdate: (id: string, diagnosis: string) => void;
  onSolutionUpdate: (id: string, solution: string, confidence?: number, solutionProvider?: 'gemini' | 'groq' | 'error' | 'unknown') => void;
}

export function IncidentCard({ item, index, isExpanded, onToggleExpand, onOpenModal, onDiagnosisUpdate, onSolutionUpdate }: IncidentCardProps) {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [isWaitingForAutoDiagnosis, setIsWaitingForAutoDiagnosis] = useState(!item.hasDiagnosis && !item.hasSolution);
  const [isGettingSolution, setIsGettingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  // Check if incident is resolved
  const isResolved = item.statusHistory && item.statusHistory.length > 0 
    ? item.statusHistory[item.statusHistory.length - 1].status === 'Resolved'
    : false;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking the modal button or diagnosis button
    if ((e.target as HTMLElement).closest('.modal-trigger') || (e.target as HTMLElement).closest('.diagnosis-button')) {
      return;
    }
    onToggleExpand(item.id);
  };

  const handleModalOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(item);
  };

  const timeoutRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Set up timeout for auto-diagnosis
  useEffect(() => {
    if (!item.hasDiagnosis && !item.hasSolution && isWaitingForAutoDiagnosis) {
      // Wait 10 seconds for diagnosis/solution to arrive via WebSocket
      timeoutRef.current = window.setTimeout(() => {
        setIsWaitingForAutoDiagnosis(false);
      }, 10000); // 10 second timeout
    } else if (item.hasDiagnosis || item.hasSolution) {
      // Diagnosis or solution arrived, clear timeout
      setIsWaitingForAutoDiagnosis(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [item.hasDiagnosis, item.hasSolution, item.id, isWaitingForAutoDiagnosis]);

  // Auto-scroll card into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      // Use requestAnimationFrame for smoother animation sync
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        });
      });
    }
  }, [isExpanded]);

  const handleGetDiagnosis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDiagnosing(true);
    setDiagnosisError(null);
    
    try {
      const analysis = await triggerDiagnosis(item.id);
      
      // Check if the response is an error message (not a valid diagnosis that mentions errors)
      const isErrorMessage = 
        analysis.diagnosis.startsWith('Failed to') ||
        analysis.diagnosis.startsWith('Error:') ||
        analysis.diagnosis.startsWith('Cannot') ||
        analysis.diagnosis.includes('Unable to generate') ||
        analysis.diagnosis.includes('AI service returned') ||
        analysis.diagnosis.includes('Gemini API') ||
        analysis.diagnosis.includes('Network error') ||
        analysis.diagnosis.includes('invalid response');
      
      if (isErrorMessage) {
        setDiagnosisError(analysis.diagnosis);
      } else if (analysis.diagnosis && analysis.diagnosis.length > 10) {
        onDiagnosisUpdate(item.id, analysis.diagnosis);
      } else {
        setDiagnosisError('Failed to get diagnosis. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to get diagnosis:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection.';
      setDiagnosisError(errorMessage);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleGetSolution = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGettingSolution(true);
    setSolutionError(null);
    
    try {
      const analysis = await triggerSuggestedFix(item.id);
      
      // Check if the response is an error message (not a valid solution that mentions errors)
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
        onSolutionUpdate(item.id, analysis.solution, analysis.confidence, analysis.solution_provider as 'gemini' | 'groq' | 'error' | 'unknown');
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
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={(el) => {
            provided.innerRef(el);
            cardRef.current = el;
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-card rounded-lg shadow-sm hover:shadow-md p-4 mb-3 border-theme relative ${
            snapshot.isDragging ? 'shadow-lg no-theme-transition' : ''
          } ${isExpanded && !snapshot.isDragging ? 'shadow-orange z-10' : 'z-0'}
          ${!snapshot.isDragging ? 'transition-shadow duration-300' : ''}`}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: `rgb(var(--card-bg))`,
            borderColor: isExpanded && !snapshot.isDragging ? 'rgb(249, 115, 22)' : `rgb(var(--border-color))`,
            borderWidth: '1px',
          }}
        >
          <div onClick={handleCardClick} className="cursor-pointer">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: `rgb(var(--card-text-secondary))` }}>{item.incidentNumber}</span>
              {/* Subtle agent classification icons */}
              {item.actionable && item.incidentType === 'real_system' && (
                <span 
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  title="SRE Agent Ready - can take automated actions"
                  style={{ color: 'rgb(249, 115, 22)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              )}
              {item.incidentType === 'synthetic' && (
                <span 
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  title="Synthetic - training scenario"
                  style={{ color: 'rgb(249, 115, 22)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
              )}
              {item.incidentType === 'training' && (
                <span 
                  className="text-sm opacity-60 hover:opacity-100 transition-opacity"
                  title="Training scenario"
                >
                  🎓
                </span>
              )}
              {item.remediationMode === 'manual' && (
                <span title="Manual remediation required">
                  <svg 
                    className="w-4 h-4 opacity-60 hover:opacity-100 transition-opacity"
                    fill="none" 
                    stroke="rgb(249, 115, 22)" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color: `rgb(var(--card-text-tertiary))` }}>{item.timeElapsed}</span>
          </div>
          
          <h3 className="text-sm font-medium mb-3 leading-tight" style={{ color: `rgb(var(--card-text-primary))` }}>
            {item.title}
          </h3>

          {/* Expanded Content */}
          {isExpanded && (
            <div 
              className="mb-3 pb-3 space-y-2 animate-expand-in" 
              style={{ 
                borderBottom: `1px solid rgb(var(--border-color))`,
                animation: 'expandIn 0.3s ease-out'
              }}
            >
              {item.affectedServices && item.affectedServices.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.affectedServices.slice(0, 2).map((service, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: 'rgb(249, 115, 22)', color: 'white' }}
                    >
                      {service}
                    </span>
                  ))}
                  {item.affectedServices.length > 2 && (
                    <span className="px-2 py-0.5 text-xs" style={{ color: `rgb(var(--card-text-secondary))` }}>
                      +{item.affectedServices.length - 2} more
                    </span>
                  )}
                </div>
              )}
              {item.assignee && (
                <p className="text-xs" style={{ color: `rgb(var(--card-text-secondary))` }}>
                  Assigned to: <span className="font-medium" style={{ color: `rgb(var(--card-text-primary))` }}>{item.assignee}</span>
                </p>
              )}
              
              {/* AI Diagnosis Section */}
              {/* Show loading state while waiting for auto-diagnosis */}
              {!item.hasDiagnosis && !item.hasSolution && isWaitingForAutoDiagnosis && !isDiagnosing && (
                <div className="w-full mt-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded-md flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Waiting for diagnosis...
                </div>
              )}
              
              {/* Show button after timeout or if manual retry needed */}
              {!item.hasDiagnosis && !item.hasSolution && !isWaitingForAutoDiagnosis && !isDiagnosing && (
                <button
                  onClick={handleGetDiagnosis}
                  disabled={isResolved}
                  className="diagnosis-button w-full mt-2 px-3 py-2 bg-linear-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ cursor: isResolved ? 'not-allowed' : 'pointer' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Get AI Diagnosis
                </button>
              )}
              
              {/* Show spinner when user manually triggers diagnosis */}
              {isDiagnosing && (
                <div className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-md flex items-center justify-center gap-2" style={{ backgroundColor: 'rgb(249, 115, 22)', color: 'white' }}>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </div>
              )}
              
              {item.hasDiagnosis && item.diagnosis && (
                <div className="w-full mt-2 px-3 py-2 border border-green-500 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-medium text-green-500">AI Diagnosis Available</p>
                  </div>
                </div>
              )}

              {/* Show "Get AI Solution" button when diagnosis exists but solution doesn't */}
              {item.hasDiagnosis && !item.hasSolution && !isGettingSolution && (
                <button
                  onClick={handleGetSolution}
                  disabled={isResolved}
                  className="diagnosis-button w-full mt-2 px-3 py-2 bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ cursor: isResolved ? 'not-allowed' : 'pointer' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Get AI Solution
                </button>
              )}

              {/* Show spinner when getting solution */}
              {isGettingSolution && (
                <div className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-md flex items-center justify-center gap-2" style={{ backgroundColor: 'rgb(249, 115, 22)', color: 'white' }}>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting solution...
                </div>
              )}
              
              {item.hasSolution && item.solution && (
                <div className="w-full mt-2 px-3 py-2 border border-blue-500 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-xs font-medium text-blue-500">Suggested Solution Available</p>
                  </div>
                </div>
              )}
              
              {diagnosisError && !isDiagnosing && (
                <div className="w-full mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-600">{diagnosisError}</p>
                  </div>
                </div>
              )}

              {solutionError && !isGettingSolution && (
                <div className="w-full mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-600">{solutionError}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {item.severity && severityConfig[item.severity] && (
                <span 
                  className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
                  style={{ 
                    backgroundColor: severityConfig[item.severity].backgroundColor, 
                    color: severityConfig[item.severity].color, 
                    border: `1px solid ${severityConfig[item.severity].borderColor}` 
                  }}
                >
                  {severityConfig[item.severity].icon}
                  <span>{severityConfig[item.severity].label}</span>
                </span>
              )}
              <span className="team-badge px-2 py-0.5 rounded text-xs border" style={{ borderColor: 'rgb(249, 115, 22)', color: 'rgb(249, 115, 22)', backgroundColor: 'transparent' }}>
                {item.team}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {isExpanded && (
                <button
                  onClick={handleModalOpen}
                  className="modal-trigger p-1.5 rounded transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Expand to full view"
                >
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ color: `rgb(var(--card-text-tertiary))` }}
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
                    />
                  </svg>
                </button>
              )}
              {item.avatarUrl ? (
                <img 
                  src={item.avatarUrl} 
                  alt="Avatar" 
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-400 to-purple-500"></div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
