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
    // Don't trigger if clicking the modal button or while dragging
    if ((e.target as HTMLElement).closest('.modal-trigger') || (e.target as HTMLElement).closest('.diagnosis-button')) {
      return;
    }
    onToggleExpand(item.id);
  };

  const handleModalOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(item);
  };

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set up timeout for auto-diagnosis
  useEffect(() => {
    if (!item.hasDiagnosis && !item.hasSolution && isWaitingForAutoDiagnosis) {
      // Wait 10 seconds for diagnosis/solution to arrive via WebSocket
      timeoutRef.current = setTimeout(() => {
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
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleCardClick}
          className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-4 mb-3 border border-gray-200 ${
            snapshot.isDragging ? 'shadow-lg' : ''
          } ${isExpanded ? 'ring-2 ring-blue-400' : ''}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">{item.incidentNumber}</span>
              {/* AI Provider Badge */}
              {item.generated_by && item.generated_by !== 'manual' && (
                <span 
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    item.generated_by === 'gemini' 
                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                      : item.generated_by === 'groq'
                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                  title={`Generated by ${item.generated_by === 'gemini' ? 'Gemini AI' : item.generated_by === 'groq' ? 'Groq AI' : 'Fallback'}`}
                >
                  {item.generated_by === 'gemini' ? '✨ Gemini' : item.generated_by === 'groq' ? '⚡ Groq' : '📋 Default'}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{item.timeElapsed}</span>
          </div>
          
          <h3 className="text-sm font-medium text-gray-900 mb-3 leading-tight">
            {item.title}
          </h3>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mb-3 pb-3 border-b border-gray-200 space-y-2">
              {item.description && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.description}
                </p>
              )}
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
                    <span className="px-2 py-0.5 text-gray-500 text-xs">
                      +{item.affectedServices.length - 2} more
                    </span>
                  )}
                </div>
              )}
              {item.assignee && (
                <p className="text-xs text-gray-500">
                  Assigned to: <span className="font-medium text-gray-700">{item.assignee}</span>
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
                <div className="w-full mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-green-800">AI Diagnosis</p>
                        {item.diagnosisProvider && item.diagnosisProvider !== 'unknown' && item.diagnosisProvider !== 'error' && (
                          <span 
                            className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
                              item.diagnosisProvider === 'gemini' 
                                ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                : 'bg-orange-100 text-orange-700 border border-orange-200'
                            }`}
                            title={`Generated by ${item.diagnosisProvider === 'gemini' ? 'Gemini AI' : 'Groq AI'}`}
                          >
                            {item.diagnosisProvider === 'gemini' ? '✨' : '⚡'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-green-700">{item.diagnosis}</p>
                    </div>
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
                <div className="w-full mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-800 mb-1">Suggested Solution</p>
                      <p className="text-xs text-blue-700">{item.solution}</p>
                    </div>
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
              <span className="flex items-center gap-1">
                <span className="text-gray-400">⬢⬢</span>
                <span className="text-gray-700 font-medium">{item.team}</span>
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
      )}
    </Draggable>
  );
}
