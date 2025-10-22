import { Draggable } from 'react-beautiful-dnd';
import { Incident } from '../types';
import { SeverityBars } from './SeverityBars';
import { useState, useEffect, useRef } from 'react';
import { triggerDiagnosis, triggerSuggestedFix } from '../services/api';

interface IncidentCardProps {
  item: Incident;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenModal: (incident: Incident) => void;
  onDiagnosisUpdate: (id: string, diagnosis: string) => void;
  onSolutionUpdate: (id: string, solution: string) => void;
}

export function IncidentCard({ item, index, isExpanded, onToggleExpand, onOpenModal, onDiagnosisUpdate, onSolutionUpdate }: IncidentCardProps) {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [isWaitingForAutoDiagnosis, setIsWaitingForAutoDiagnosis] = useState(!item.hasDiagnosis && !item.hasSolution);
  const [isGettingSolution, setIsGettingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);

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
      // Delay to allow the expand animation to complete
      window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 350); // Match the expand animation duration
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
        onSolutionUpdate(item.id, analysis.solution);
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
            borderColor: `rgb(var(--border-color))`,
            borderWidth: '1px',
            boxShadow: isExpanded && !snapshot.isDragging ? '0 0 0 2px rgba(249, 115, 22, 0.3), 0 0 15px rgba(249, 115, 22, 0.2)' : undefined
          }}
        >
          <div onClick={handleCardClick} className="cursor-pointer">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: `rgb(var(--card-text-secondary))` }}>{item.incidentNumber}</span>
              {/* AI Provider Badge */}
              {item.generated_by && item.generated_by !== 'manual' && (
                <span 
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                    item.generated_by === 'gemini' 
                      ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                      : item.generated_by === 'groq'
                      ? 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                      : 'bg-gray-100 text-gray-600 border-gray-200 ai-badge-default'
                  }`}
                  title={`Generated by ${item.generated_by === 'gemini' ? 'Gemini AI' : item.generated_by === 'groq' ? 'Groq AI' : 'Fallback'}`}
                >
                  {item.generated_by === 'gemini' ? '✨ Gemini' : item.generated_by === 'groq' ? '⚡ Groq' : '📋 Default'}
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
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
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
                  className="diagnosis-button w-full mt-2 px-3 py-2 bg-linear-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Get AI Diagnosis
                </button>
              )}
              
              {/* Show spinner when user manually triggers diagnosis */}
              {isDiagnosing && (
                <div className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-md flex items-center justify-center gap-2">
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
                    {item.diagnosisProvider && item.diagnosisProvider !== 'unknown' && item.diagnosisProvider !== 'error' && (
                      <span 
                        className={`text-[9px] px-1 py-0.5 rounded font-semibold border ${
                          item.diagnosisProvider === 'gemini' 
                            ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                            : 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                        }`}
                        title={`Generated by ${item.diagnosisProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                      >
                        {item.diagnosisProvider === 'gemini' ? '✨' : '⚡'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Show "Get AI Solution" button when diagnosis exists but solution doesn't */}
              {item.hasDiagnosis && !item.hasSolution && !isGettingSolution && (
                <button
                  onClick={handleGetSolution}
                  className="diagnosis-button w-full mt-2 px-3 py-2 bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Get AI Solution
                </button>
              )}

              {/* Show spinner when getting solution */}
              {isGettingSolution && (
                <div className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-md flex items-center justify-center gap-2">
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
                    {item.solutionProvider && item.solutionProvider !== 'unknown' && item.solutionProvider !== 'error' && (
                      <span 
                        className={`text-[9px] px-1 py-0.5 rounded font-semibold border ${
                          item.solutionProvider === 'gemini' 
                            ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                            : 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                        }`}
                        title={`Generated by ${item.solutionProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                      >
                        {item.solutionProvider === 'gemini' ? '✨' : '⚡'}
                      </span>
                    )}
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
              <SeverityBars severity={item.severity} />
              <span className="team-badge px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs">
                {item.team}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {isExpanded && (
                <button
                  onClick={handleModalOpen}
                  className="modal-trigger p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand to full view"
                >
                  <svg 
                    className="w-4 h-4 text-gray-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
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
