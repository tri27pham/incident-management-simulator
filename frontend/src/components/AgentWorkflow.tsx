import React, { useEffect, useState } from 'react';
import { AgentExecution } from '../types';
import { startAgentRemediation, getIncidentAgentExecutions, getAgentExecution, approveAgentExecution, rejectAgentExecution } from '../services/api';

interface AgentWorkflowProps {
  incidentId: string;
  canAgentAct: boolean;
  isResolved?: boolean;
}

const AgentWorkflow: React.FC<AgentWorkflowProps> = ({ incidentId, canAgentAct, isResolved = false }) => {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingExecution, setPollingExecution] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [expandedCancelledIds, setExpandedCancelledIds] = useState<Set<string>>(new Set());

  // Fetch existing executions on mount
  useEffect(() => {
    fetchExecutions();
  }, [incidentId]);

  // Poll for updates when an execution is in progress
  useEffect(() => {
    if (!pollingExecution) return;

    const interval = setInterval(async () => {
      try {
        const execution = await getAgentExecution(pollingExecution);
        
        // Update the execution in the list
        setExecutions(prev => 
          prev.map(ex => ex.id === execution.id ? mapExecution(execution) : ex)
        );

        // Stop polling if completed or failed
        if (execution.status === 'completed' || execution.status === 'failed') {
          setPollingExecution(null);
        }
      } catch (err) {
        console.error('Failed to poll execution:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pollingExecution]);

  const fetchExecutions = async () => {
    try {
      const data = await getIncidentAgentExecutions(incidentId);
      setExecutions(data.map(mapExecution));
      
      // If there's an in-progress execution, start polling
      const inProgress = data.find(ex => 
        ex.status !== 'completed' && ex.status !== 'failed'
      );
      if (inProgress) {
        setPollingExecution(inProgress.id);
      }
    } catch (err) {
      console.error('Failed to fetch executions:', err);
    }
  };

  const mapExecution = (raw: any): AgentExecution => ({
    id: raw.id,
    incident_id: raw.incident_id,
    status: raw.status,
    agent_model: raw.agent_model,
    analysis: raw.analysis,
    recommended_action: raw.recommended_action,
    reasoning: raw.reasoning,
    commands: raw.commands?.Data || raw.commands,
    risks: raw.risks?.Data || raw.risks,
    estimated_impact: raw.estimated_impact,
    execution_logs: raw.execution_logs?.Data || raw.execution_logs,
    verification_checks: raw.verification_checks?.Data || raw.verification_checks,
    verification_passed: raw.verification_passed,
    verification_notes: raw.verification_notes,
    success: raw.success,
    error_message: raw.error_message,
    rollback_performed: raw.rollback_performed,
    dry_run: raw.dry_run,
    started_at: raw.started_at,
    completed_at: raw.completed_at,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  });

  const handleStartRemediation = async () => {
    setLoading(true);
    setError(null);
    try {
      const execution = await startAgentRemediation(incidentId);
      const mapped = mapExecution(execution);
      setExecutions(prev => [mapped, ...prev]);
      setPollingExecution(execution.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (executionId: string) => {
    setApprovingId(executionId);
    try {
      const execution = await approveAgentExecution(executionId);
      const mapped = mapExecution(execution);
      setExecutions(prev => prev.map(ex => ex.id === executionId ? mapped : ex));
      setPollingExecution(executionId); // Resume polling
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (executionId: string) => {
    setApprovingId(executionId);
    try {
      const execution = await rejectAgentExecution(executionId);
      const mapped = mapExecution(execution);
      setExecutions(prev => prev.map(ex => ex.id === executionId ? mapped : ex));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const toggleCancelledExpanded = (executionId: string) => {
    setExpandedCancelledIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking': return '🧠';
      case 'previewing': return '📋';
      case 'awaiting_approval': return '⏳';
      case 'executing': return '⚡';
      case 'verifying': return '🔍';
      case 'completed': return '✅';
      case 'cancelled': return '🚫';
      case 'failed': return '❌';
      default: return '⏺️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'thinking':
      case 'previewing':
      case 'awaiting_approval':
        return 'rgb(59, 130, 246)'; // blue
      case 'executing':
      case 'verifying':
        return 'rgb(168, 85, 247)'; // purple
      case 'completed':
        return 'rgb(34, 197, 94)'; // green
      case 'cancelled':
        return 'rgb(107, 114, 128)'; // gray
      case 'failed':
        return 'rgb(239, 68, 68)'; // red
      default:
        return 'rgb(107, 114, 128)'; // gray
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'rgb(239, 68, 68)';
      case 'medium': return 'rgb(251, 146, 60)';
      case 'low': return 'rgb(34, 197, 94)';
      default: return 'rgb(107, 114, 128)';
    }
  };

  if (!canAgentAct) {
    return (
      <div 
        className="p-4 rounded-lg"
        style={{ 
          backgroundColor: 'rgb(var(--bg-secondary))',
          border: '1px solid rgb(var(--border-color))'
        }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
          <span>🔒</span>
          <span>SRE agent remediation is not available for this incident type.</span>
        </div>
      </div>
    );
  }

  // Check if there's an active (non-cancelled, non-failed) execution
  const hasActiveExecution = executions.some(ex => 
    ex.status !== 'cancelled' && ex.status !== 'failed'
  );

  // Check if the most recent execution failed or was cancelled
  const latestExecution = executions[0];
  const showRetryForFailed = latestExecution && (latestExecution.status === 'failed' || latestExecution.status === 'cancelled');

  return (
    <div className="space-y-4">
      {/* Start/Retry Remediation Button */}
      {!hasActiveExecution && (
        <button
          onClick={handleStartRemediation}
          disabled={loading || isResolved}
          className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
          style={{
            backgroundColor: (loading || isResolved) ? 'rgb(107, 114, 128)' : 'rgb(249, 115, 22)',
            color: 'white',
            opacity: (loading || isResolved) ? 0.5 : 1,
            cursor: (loading || isResolved) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting...
            </>
          ) : showRetryForFailed ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry SRE Agent Remediation
            </>
          ) : (
            'Start SRE Agent Remediation'
          )}
        </button>
      )}

      {error && (
        <div 
          className="p-3 rounded-lg text-sm"
          style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgb(239, 68, 68)',
            color: 'rgb(239, 68, 68)'
          }}
        >
          {error}
        </div>
      )}

      {/* Execution History */}
      {executions.map((execution) => {
        const isCancelled = execution.status === 'cancelled';
        const isExpanded = expandedCancelledIds.has(execution.id);
        
        // Collapsed view for cancelled executions
        if (isCancelled && !isExpanded) {
          return (
            <button
              key={execution.id}
              onClick={() => toggleCancelledExpanded(execution.id)}
              className="w-full rounded-lg p-3 flex items-center justify-between hover:opacity-80 transition-opacity cursor-pointer"
              style={{
                backgroundColor: 'rgba(107, 114, 128, 0.1)',
                border: '1px solid rgb(107, 114, 128)'
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🚫</span>
                <div className="text-left">
                  <div className="text-sm font-medium" style={{ color: 'rgb(107, 114, 128)' }}>
                    Cancelled
                  </div>
                  <div className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                    {new Date(execution.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <svg 
                className="w-4 h-4"
                style={{ color: 'rgb(107, 114, 128)' }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          );
        }
        
        // Full view for active executions or expanded cancelled ones
        return (
          <div
            key={execution.id}
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              border: '1px solid rgb(var(--border-color))'
            }}
          >
            {/* Header */}
            <div 
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgb(var(--border-color))' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(execution.status)}</span>
                <div>
                  <div className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                    {formatStatus(execution.status)}
                  </div>
                  <div className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                    {new Date(execution.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${getStatusColor(execution.status)}20`,
                    color: getStatusColor(execution.status)
                  }}
                >
                  {formatStatus(execution.status)}
                </div>
                {isCancelled && (
                  <button
                    onClick={() => toggleCancelledExpanded(execution.id)}
                    className="p-1 hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <svg 
                      className="w-4 h-4 transform rotate-180"
                      style={{ color: 'rgb(var(--text-tertiary))' }}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
            {/* Phase 1: Thinking */}
            {execution.status === 'thinking' && !execution.analysis && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>🧠</span>
                  <span>Analyzing Incident...</span>
                </div>
                <div 
                  className="p-4 rounded flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8" style={{ color: 'rgb(59, 130, 246)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      AI is analyzing the incident and determining the best course of action...
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {execution.analysis && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>🧠</span>
                  <span>Analysis</span>
                </div>
                <div 
                  className="p-3 rounded text-sm"
                  style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'rgb(var(--text-secondary))'
                  }}
                >
                  {execution.analysis}
                </div>
                {execution.recommended_action && (
                  <div className="text-sm">
                    <span style={{ color: 'rgb(var(--text-tertiary))' }}>Recommended Action: </span>
                    <span 
                      className="font-mono px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        color: 'rgb(168, 85, 247)'
                      }}
                    >
                      {execution.recommended_action}
                    </span>
                  </div>
                )}
                {execution.reasoning && (
                  <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                    <span style={{ color: 'rgb(var(--text-tertiary))' }}>Reasoning: </span>
                    {execution.reasoning}
                  </div>
                )}
              </div>
            )}

            {/* Phase 2: Command Preview */}
            {execution.commands && Array.isArray(execution.commands) && execution.commands.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>📋</span>
                  <span>Commands ({execution.commands.length})</span>
                </div>
                <div className="space-y-2">
                  {execution.commands.map((cmd: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded"
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.05)',
                        border: '1px solid rgba(168, 85, 247, 0.2)'
                      }}
                    >
                      <div className="font-medium text-sm mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
                        {cmd.name}
                      </div>
                      <div 
                        className="font-mono text-xs p-2 rounded mb-2"
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          color: 'rgb(34, 197, 94)'
                        }}
                      >
                        {cmd.command} {cmd.args?.join(' ')}
                      </div>
                      <div className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                        {cmd.description}
                      </div>
                    </div>
                  ))}
                </div>
                {execution.estimated_impact && (
                  <div 
                    className="p-2 rounded text-xs"
                    style={{ 
                      backgroundColor: 'rgba(251, 146, 60, 0.1)',
                      color: 'rgb(var(--text-secondary))'
                    }}
                  >
                    <strong>Impact:</strong> {execution.estimated_impact}
                  </div>
                )}
              </div>
            )}

            {/* Risks */}
            {execution.risks && Array.isArray(execution.risks) && execution.risks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>⚠️</span>
                  <span>Risks</span>
                </div>
                <div className="space-y-2">
                  {execution.risks.map((risk: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 rounded text-xs"
                      style={{
                        backgroundColor: `${getRiskColor(risk.level)}10`,
                        border: `1px solid ${getRiskColor(risk.level)}40`
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="px-2 py-0.5 rounded uppercase font-bold"
                          style={{
                            backgroundColor: getRiskColor(risk.level),
                            color: 'white',
                            fontSize: '10px'
                          }}
                        >
                          {risk.level}
                        </span>
                        <span style={{ color: 'rgb(var(--text-secondary))' }}>{risk.description}</span>
                      </div>
                      <div style={{ color: 'rgb(var(--text-tertiary))' }}>
                        Mitigation: {risk.mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Prompt / Execution Status */}
            {(execution.status === 'awaiting_approval' || execution.status === 'executing' || execution.status === 'verifying') && (
              <div 
                className="p-3 rounded-lg"
                style={{ 
                  backgroundColor: execution.status === 'awaiting_approval' 
                    ? 'rgba(249, 115, 22, 0.1)' 
                    : 'rgba(59, 130, 246, 0.1)',
                  border: execution.status === 'awaiting_approval'
                    ? '2px solid rgb(249, 115, 22)'
                    : '2px solid rgb(59, 130, 246)'
                }}
              >
                {execution.status === 'awaiting_approval' ? (
                  <>
                    <div className="flex items-start gap-2 mb-3">
                      <svg className="w-5 h-5 shrink-0" style={{ color: 'rgb(249, 115, 22)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <div className="font-semibold mb-1 text-sm" style={{ color: 'rgb(249, 115, 22)' }}>
                          Approval Required
                        </div>
                        <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                          Review the commands and risks above before proceeding.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(execution.id)}
                        disabled={approvingId === execution.id}
                        className="flex-1 py-1.5 px-3 rounded-lg font-medium text-sm"
                        style={{
                          backgroundColor: approvingId === execution.id ? 'rgb(107, 114, 128)' : 'rgb(34, 197, 94)',
                          color: 'white',
                          opacity: approvingId === execution.id ? 0.6 : 1,
                          cursor: approvingId === execution.id ? 'not-allowed' : 'pointer',
                          transform: approvingId === execution.id ? 'scale(0.95)' : 'scale(1)',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        {approvingId === execution.id ? 'Approving...' : '✓ Approve & Execute'}
                      </button>
                      <button
                        onClick={() => handleReject(execution.id)}
                        disabled={approvingId === execution.id}
                        className="flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-sm"
                        style={{
                          backgroundColor: approvingId === execution.id ? 'rgb(107, 114, 128)' : 'rgb(239, 68, 68)',
                          color: 'white',
                          opacity: approvingId === execution.id ? 0.6 : 1,
                          cursor: approvingId === execution.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {approvingId === execution.id ? 'Rejecting...' : '✗ Reject'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <svg className="animate-spin h-4 w-4" style={{ color: 'rgb(59, 130, 246)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium text-xs" style={{ color: 'rgb(59, 130, 246)' }}>
                      {execution.status === 'executing' ? '⚡ Executing commands...' : '🔍 Verifying results...'}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Completion Status */}
            {execution.status === 'completed' && execution.success && execution.verification_passed && (
              <div 
                className="p-3 rounded-lg"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '2px solid rgb(34, 197, 94)',
                  animation: 'fadeIn 0.5s ease-in'
                }}
              >
                <style>
                  {`
                    @keyframes fadeIn {
                      from {
                        opacity: 0;
                        transform: scale(0.95);
                      }
                      to {
                        opacity: 1;
                        transform: scale(1);
                      }
                    }
                    @keyframes checkmark {
                      0% {
                        transform: scale(0) rotate(0deg);
                      }
                      50% {
                        transform: scale(1.2) rotate(10deg);
                      }
                      100% {
                        transform: scale(1) rotate(0deg);
                      }
                    }
                  `}
                </style>
                <div className="flex items-center justify-center gap-2 py-1.5">
                  <svg 
                    className="w-6 h-6" 
                    style={{ 
                      color: 'rgb(34, 197, 94)',
                      animation: 'checkmark 0.6s ease-out'
                    }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'rgb(34, 197, 94)' }}>
                      ✅ Incident Resolved Successfully
                    </div>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      All remediation actions completed and verified.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 3: Execution Logs */}
            {execution.execution_logs && Array.isArray(execution.execution_logs) && execution.execution_logs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>⚡</span>
                  <span>Execution Logs</span>
                </div>
                <div className="space-y-2">
                  {execution.execution_logs.map((log: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 rounded"
                      style={{
                        backgroundColor: log.status === 'success' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${log.status === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {log.command}
                        </span>
                        <span className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                          {log.duration_ms}ms
                        </span>
                      </div>
                      <div 
                        className="font-mono text-xs p-1.5 rounded"
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          color: 'rgb(var(--text-tertiary))',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {log.output || log.error_detail || 'No output'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase 4: Verification */}
            {execution.verification_checks && Array.isArray(execution.verification_checks) && execution.verification_checks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  <span>🔍</span>
                  <span>Verification</span>
                </div>
                <div className="space-y-2">
                  {execution.verification_checks.map((check: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded"
                      style={{
                        backgroundColor: check.passed ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${check.passed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                          {check.passed ? '✓' : '✗'} {check.check_name}
                        </span>
                      </div>
                      <div className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {check.description}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: 'rgb(var(--text-tertiary))' }}>Expected:</span>
                        <span style={{ color: 'rgb(var(--text-secondary))' }}>{check.expected}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: 'rgb(var(--text-tertiary))' }}>Result:</span>
                        <span style={{ color: check.passed ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}>
                          {check.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {execution.verification_notes && (
                  <div 
                    className="p-2 rounded text-xs"
                    style={{ 
                      backgroundColor: execution.verification_passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: 'rgb(var(--text-secondary))'
                    }}
                  >
                    {execution.verification_notes}
                  </div>
                )}
              </div>
            )}

            {/* Cancelled/Rejected Status */}
            {execution.status === 'cancelled' && (
              <div 
                className="p-4 rounded-lg"
                style={{ 
                  backgroundColor: 'rgba(107, 114, 128, 0.1)',
                  border: '2px solid rgb(107, 114, 128)'
                }}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 shrink-0" style={{ color: 'rgb(107, 114, 128)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold" style={{ color: 'rgb(107, 114, 128)' }}>
                      Execution Cancelled
                    </div>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {execution.error_message === 'Rejected by user' 
                        ? 'You rejected this remediation plan. You can start a new execution if needed.'
                        : execution.error_message || 'This execution was cancelled.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message (for actual errors, not rejections) */}
            {execution.error_message && execution.status === 'failed' && (
              <div 
                className="p-3 rounded text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgb(239, 68, 68)',
                  color: 'rgb(239, 68, 68)',
                  animation: 'fadeIn 0.5s ease-in'
                }}
              >
                <div className="font-medium mb-1">Error</div>
                {execution.error_message}
              </div>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgentWorkflow;

