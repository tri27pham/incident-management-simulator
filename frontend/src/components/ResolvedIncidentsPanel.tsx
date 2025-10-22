import { useState } from 'react';
import { Incident } from '../types';
import { SeverityBars } from './SeverityBars';

interface ResolvedIncidentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
}

export function ResolvedIncidentsPanel({ isOpen, onClose, incidents }: ResolvedIncidentsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className={`fixed inset-0 bg-black z-40 transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-2xl shadow-2xl z-50 overflow-y-auto rounded-l-lg ${
          isOpen ? '' : 'pointer-events-none'
        }`}
        style={{ 
          backgroundColor: `rgb(var(--bg-secondary))`,
          scrollBehavior: 'smooth',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ 
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderBottom: `1px solid rgb(var(--border-color))`
          }}
        >
          <div>
            <h2 className="text-xl font-semibold text-primary">Resolved Incidents</h2>
            <p className="text-sm text-secondary mt-1">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} resolved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-theme-button-hover"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {incidents.length === 0 ? (
            <div className="text-center py-12">
              <svg 
                className="w-16 h-16 mx-auto mb-4 text-tertiary" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <p className="text-secondary">No resolved incidents yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => {
                const isExpanded = expandedId === incident.id;
                return (
                  <div
                    key={incident.id}
                    onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                    className={`rounded-lg p-4 border cursor-pointer transition-all duration-200 ${
                      isExpanded ? 'shadow-lg' : 'hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: `rgb(var(--card-bg))`,
                      borderColor: `rgb(var(--border-color))`,
                      borderWidth: '1px',
                      boxShadow: isExpanded ? '0 0 0 2px rgba(249, 115, 22, 0.3), 0 0 15px rgba(249, 115, 22, 0.2)' : undefined
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-secondary">{incident.incidentNumber}</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          Resolved
                        </span>
                        {incident.generated_by && incident.generated_by !== 'manual' && (
                          <span 
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                              incident.generated_by === 'gemini' 
                                ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                                : incident.generated_by === 'groq'
                                ? 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                                : 'bg-gray-100 text-gray-600 border-gray-200 ai-badge-default'
                            }`}
                          >
                            {incident.generated_by === 'gemini' ? '✨' : incident.generated_by === 'groq' ? '⚡' : '📋'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-tertiary">{incident.timeElapsed}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-medium mb-2 text-primary">
                      {incident.title}
                    </h3>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mb-3 pb-3 space-y-3" style={{ borderBottom: `1px solid rgb(var(--border-color))` }}>
                        {/* Affected Services */}
                        {incident.affectedServices && incident.affectedServices.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-secondary mb-1">Affected Services:</p>
                            <div className="flex flex-wrap gap-1">
                              {incident.affectedServices.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                                >
                                  {service}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI Diagnosis */}
                        {incident.hasDiagnosis && incident.diagnosis && (
                          <div className="rounded-lg p-3" style={{ backgroundColor: `rgb(var(--bg-secondary))`, border: `2px solid rgb(74, 222, 128)` }}>
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(74, 222, 128)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-xs font-semibold text-primary">AI Diagnosis</p>
                              {incident.diagnosisProvider && incident.diagnosisProvider !== 'unknown' && (
                                <span 
                                  className={`text-[9px] px-1 py-0.5 rounded font-semibold border ${
                                    incident.diagnosisProvider === 'gemini' 
                                      ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                      : 'bg-orange-100 text-orange-700 border-orange-200'
                                  }`}
                                >
                                  {incident.diagnosisProvider === 'gemini' ? '✨' : '⚡'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-secondary max-h-32 overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                              {incident.diagnosis}
                            </div>
                          </div>
                        )}

                        {/* Suggested Solution */}
                        {incident.hasSolution && incident.solution && (
                          <div className="rounded-lg p-3" style={{ backgroundColor: `rgb(var(--bg-secondary))`, border: `2px solid rgb(96, 165, 250)` }}>
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(96, 165, 250)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              <p className="text-xs font-semibold text-primary">Suggested Solution</p>
                              {incident.solutionProvider && incident.solutionProvider !== 'unknown' && (
                                <span 
                                  className={`text-[9px] px-1 py-0.5 rounded font-semibold border ${
                                    incident.solutionProvider === 'gemini' 
                                      ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                      : 'bg-orange-100 text-orange-700 border-orange-200'
                                  }`}
                                >
                                  {incident.solutionProvider === 'gemini' ? '✨' : '⚡'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-secondary max-h-32 overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                              {incident.solution}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        {incident.timeline && incident.timeline.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-secondary mb-2">Resolution Timeline:</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {incident.timeline.map((entry, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <div className="flex flex-col items-center">
                                    <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                                      style={{ 
                                        backgroundColor: entry.status === 'Resolved' ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)'
                                      }}
                                    />
                                    {idx < incident.timeline.length - 1 && (
                                      <div 
                                        className="w-0.5 h-full min-h-4"
                                        style={{ backgroundColor: `rgb(var(--border-color))` }}
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span 
                                        className="text-xs font-medium px-2 py-0.5 rounded"
                                        style={{
                                          backgroundColor: entry.status === 'Resolved' 
                                            ? 'rgb(220, 252, 231)' 
                                            : 'rgb(219, 234, 254)',
                                          color: entry.status === 'Resolved'
                                            ? 'rgb(22, 101, 52)'
                                            : 'rgb(29, 78, 216)'
                                        }}
                                      >
                                        {entry.status}
                                      </span>
                                      <span className="text-xs text-tertiary">{entry.timestamp}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex items-center justify-between">
                      <SeverityBars severity={incident.severity} />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary">{incident.team}</span>
                        {!isExpanded && incident.hasSolution && (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

