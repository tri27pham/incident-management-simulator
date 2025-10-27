import { Incident } from '../types';
import { useState, useEffect } from 'react';
import { SeverityBars } from './SeverityBars';
import { getIncidentAgentExecutions, AgentExecutionResponse } from '../services/api';

interface ResolvedIncidentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
}

export function ResolvedIncidentsPanel({ isOpen, onClose, incidents }: ResolvedIncidentsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentExecutions, setAgentExecutions] = useState<Map<string, AgentExecutionResponse[]>>(new Map());
  const [loadingExecutions, setLoadingExecutions] = useState<Set<string>>(new Set());

  // Fetch agent executions when an incident is expanded
  useEffect(() => {
    if (!expandedId) return;

    const incident = incidents.find(inc => inc.id === expandedId);
    if (!incident || !incident.actionable || incident.incidentType !== 'real_system') return;

    // Check if we already have the executions
    if (agentExecutions.has(expandedId)) return;

    // Fetch executions
    setLoadingExecutions(prev => new Set(prev).add(expandedId));
    getIncidentAgentExecutions(expandedId)
      .then(executions => {
        setAgentExecutions(prev => {
          const newMap = new Map(prev);
          newMap.set(expandedId, executions);
          return newMap;
        });
      })
      .catch(err => {
        console.error('Failed to fetch agent executions:', err);
      })
      .finally(() => {
        setLoadingExecutions(prev => {
          const newSet = new Set(prev);
          newSet.delete(expandedId);
          return newSet;
        });
      });
  }, [expandedId, incidents, agentExecutions]);
  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className={`fixed inset-0 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          zIndex: 60,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-2xl shadow-2xl overflow-y-auto rounded-l-lg ${
          isOpen ? '' : 'pointer-events-none'
        }`}
        style={{ 
          zIndex: 70,
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : incident.id);
                    }}
                    className={`rounded-lg p-4 border cursor-pointer transition-all duration-200 ${
                      isExpanded ? 'shadow-lg' : 'hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: `rgb(var(--card-bg))`,
                      borderColor: isExpanded ? 'rgb(249, 115, 22)' : `rgb(var(--border-color))`,
                      borderWidth: '1px',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-secondary">{incident.incidentNumber}</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          Resolved
                        </span>
                        {incident.actionable && incident.incidentType === 'real_system' && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            title="AI Agent Ready"
                          >
                            🤖
                          </span>
                        )}
                        {incident.incidentType === 'synthetic' && (
                          <span 
                            className="text-xs opacity-60"
                            title="Synthetic incident"
                          >
                            📝
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
                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-secondary))` }}>
                          <div>
                            <p className="text-xs text-tertiary">Team</p>
                            <p className="text-xs font-medium text-primary">{incident.team}</p>
                          </div>
                          {incident.generated_by && (
                            <div>
                              <p className="text-xs text-tertiary">Generated By</p>
                              <p className="text-xs font-medium text-primary">{incident.generated_by}</p>
                            </div>
                          )}
                          {incident.createdAt && (
                            <div>
                              <p className="text-xs text-tertiary">Created</p>
                              <p className="text-xs font-medium text-primary">{incident.createdAt}</p>
                            </div>
                          )}
                          {incident.incidentType && (
                            <div>
                              <p className="text-xs text-tertiary">Type</p>
                              <p className="text-xs font-medium text-primary capitalize">{incident.incidentType.replace('_', ' ')}</p>
                            </div>
                          )}
                        </div>

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
                            </div>
                            <div className="text-xs text-secondary max-h-32 overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                              {incident.solution}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {incident.notes && incident.notes.trim() && (
                          <div className="rounded-lg p-3" style={{ backgroundColor: `rgb(var(--bg-secondary))`, border: `1px solid rgb(var(--border-color))` }}>
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-xs font-semibold text-primary">Notes</p>
                            </div>
                            <div className="text-xs text-secondary max-h-32 overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                              {incident.notes}
                            </div>
                          </div>
                        )}

                        {/* AI Agent Execution (for agent-resolved incidents) */}
                        {incident.actionable && incident.incidentType === 'real_system' && (
                          <div className="rounded-lg p-3" style={{ backgroundColor: `rgb(var(--bg-secondary))`, border: `2px solid rgb(34, 197, 94)` }}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm">🤖</span>
                              <p className="text-xs font-semibold text-primary">AI Agent Remediation</p>
                            </div>

                            {loadingExecutions.has(incident.id) ? (
                              <div className="flex items-center justify-center py-4">
                                <svg className="animate-spin h-5 w-5" style={{ color: 'rgb(59, 130, 246)' }} fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            ) : agentExecutions.has(incident.id) && agentExecutions.get(incident.id)!.length > 0 ? (
                              <div className="space-y-3">
                                {agentExecutions.get(incident.id)!.map((execution) => (
                                  <div key={execution.id} className="space-y-2">
                                    {/* Status */}
                                    <div className="text-xs">
                                      <span className="text-tertiary">Status: </span>
                                      <span className="font-medium text-green-600">
                                        {execution.status === 'completed' && execution.success && execution.verification_passed 
                                          ? '✅ Completed & Verified' 
                                          : execution.status}
                                      </span>
                                    </div>

                                    {/* Analysis */}
                                    {execution.analysis && (
                                      <div className="text-xs">
                                        <span className="text-tertiary block mb-1">AI Analysis:</span>
                                        <div 
                                          className="p-2 rounded max-h-32 overflow-y-auto text-secondary"
                                          style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                                        >
                                          {execution.analysis}
                                        </div>
                                      </div>
                                    )}

                                    {/* Commands */}
                                    {execution.commands && Array.isArray(execution.commands) && execution.commands.length > 0 && (
                                      <div className="text-xs">
                                        <span className="text-tertiary block mb-1">Commands Executed:</span>
                                        <div className="space-y-1">
                                          {execution.commands.map((cmd: any, idx: number) => (
                                            <div 
                                              key={idx}
                                              className="p-2 rounded font-mono text-xs"
                                              style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', color: 'rgb(var(--text-primary))' }}
                                            >
                                              <div className="font-semibold">{cmd.action || cmd.type}</div>
                                              {cmd.description && (
                                                <div className="text-tertiary text-xs mt-1">{cmd.description}</div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Execution Logs */}
                                    {execution.execution_logs && Array.isArray(execution.execution_logs) && execution.execution_logs.length > 0 && (
                                      <div className="text-xs">
                                        <span className="text-tertiary block mb-1">Execution Logs:</span>
                                        <div 
                                          className="p-2 rounded font-mono text-xs max-h-32 overflow-y-auto"
                                          style={{ backgroundColor: 'rgba(107, 114, 128, 0.05)', color: 'rgb(var(--text-secondary))' }}
                                        >
                                          {execution.execution_logs.map((log: any, idx: number) => (
                                            <div key={idx} className="py-0.5">
                                              {typeof log === 'string' ? log : `${log.command} (${log.duration_ms}ms) - ${log.status}`}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Verification */}
                                    {execution.verification_checks && Array.isArray(execution.verification_checks) && execution.verification_checks.length > 0 && (
                                      <div className="text-xs">
                                        <span className="text-tertiary block mb-1">Verification:</span>
                                        <div className="space-y-1">
                                          {execution.verification_checks.map((check: any, idx: number) => (
                                            <div 
                                              key={idx}
                                              className="flex items-start gap-2 p-2 rounded"
                                              style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}
                                            >
                                              <span>{check.passed ? '✅' : '❌'}</span>
                                              <div className="flex-1">
                                                <div className="font-medium text-secondary">{check.name}</div>
                                                {check.message && (
                                                  <div className="text-tertiary text-xs mt-0.5">{check.message}</div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Timing */}
                                    {execution.completed_at && (
                                      <div className="text-xs text-tertiary pt-2" style={{ borderTop: `1px solid rgb(var(--border-color))` }}>
                                        Completed: {new Date(execution.completed_at).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-xs">
                                  <span className="text-tertiary">Status: </span>
                                  <span className="font-medium text-green-600">Completed & Verified</span>
                                </div>
                                {incident.affectedSystems && incident.affectedSystems.length > 0 && (
                                  <div className="text-xs">
                                    <span className="text-tertiary">Target Systems: </span>
                                    <span className="font-medium text-secondary">{incident.affectedSystems.join(', ')}</span>
                                  </div>
                                )}
                                {incident.remediationMode && (
                                  <div className="text-xs">
                                    <span className="text-tertiary">Remediation Mode: </span>
                                    <span className="font-medium text-secondary capitalize">{incident.remediationMode}</span>
                                  </div>
                                )}
                                <div className="text-xs text-secondary pt-1" style={{ borderTop: `1px solid rgb(var(--border-color))` }}>
                                  This incident was automatically resolved by the AI agent through automated remediation actions.
                                </div>
                              </div>
                            )}
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
                                      className="w-2 h-2 rounded-full shrink-0 mt-1"
                                      style={{ 
                                        backgroundColor: entry.status === 'Resolved' ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)'
                                      }}
                                    />
                                    {idx < (incident.timeline?.length ?? 0) - 1 && (
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

