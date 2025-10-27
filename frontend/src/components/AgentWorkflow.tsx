import React, { useEffect, useState } from 'react';
import { AgentExecution } from '../types';
import { startAgentRemediation, getIncidentAgentExecutions, getAgentExecution } from '../services/api';

interface AgentWorkflowProps {
  incidentId: string;
  canAgentAct: boolean;
}

const AgentWorkflow: React.FC<AgentWorkflowProps> = ({ incidentId, canAgentAct }) => {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingExecution, setPollingExecution] = useState<string | null>(null);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking': return '🧠';
      case 'previewing': return '📋';
      case 'awaiting_approval': return '⏳';
      case 'executing': return '⚡';
      case 'verifying': return '🔍';
      case 'completed': return '✅';
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
          <span>AI agent remediation is not available for this incident type.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Start Remediation Button */}
      {executions.length === 0 && (
        <button
          onClick={handleStartRemediation}
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: loading ? 'rgb(107, 114, 128)' : 'rgb(34, 197, 94)',
            color: 'white',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span>
              Starting AI Agent...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🤖</span>
              Start AI Agent Remediation
            </span>
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
      {executions.map((execution) => (
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
            <div
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${getStatusColor(execution.status)}20`,
                color: getStatusColor(execution.status)
              }}
            >
              {formatStatus(execution.status)}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Phase 1: Thinking */}
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

            {/* Error Message */}
            {execution.error_message && (
              <div 
                className="p-3 rounded text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgb(239, 68, 68)',
                  color: 'rgb(239, 68, 68)'
                }}
              >
                <div className="font-medium mb-1">Error</div>
                {execution.error_message}
              </div>
            )}

            {/* Success Summary */}
            {execution.status === 'completed' && execution.success && (
              <div 
                className="p-3 rounded text-sm flex items-center gap-2"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgb(34, 197, 94)',
                  color: 'rgb(34, 197, 94)'
                }}
              >
                <span className="text-xl">🎉</span>
                <span className="font-medium">Remediation completed successfully!</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentWorkflow;

