# 🤖 AI Agent Remediation System

## Overview

The AI Agent Remediation System is a fully automated incident response system that can analyze, plan, execute, and verify remediation actions for real system incidents. It operates with strict safety controls to prevent unintended actions on production systems.

## Features

### ✅ Implemented

1. **Multi-Phase Workflow**
   - 🧠 **Thinking Phase**: AI analyzes incident and recommends action
   - 📋 **Command Preview**: Generates specific remediation commands
   - ⏳ **Approval Phase**: (Currently auto-approved, ready for manual approval)
   - ⚡ **Execution Phase**: Runs commands with logging
   - 🔍 **Verification Phase**: Checks if remediation worked
   - ✅ **Completion**: Reports success/failure with full audit trail

2. **Safety Controls**
   - Only acts on incidents marked as `actionable: true`
   - Only acts on `incident_type: real_system` incidents
   - Only acts on `remediation_mode: automated` incidents
   - Whitelist of allowed systems in `backend/internal/agent/registry.go`
   - Full execution logging and audit trail

3. **Supported Actions**
   - **Clear Redis Cache**: `FLUSHALL` to free memory
   - **Restart Redis**: Container restart for error recovery
   - Extensible architecture for additional actions

4. **Frontend UI**
   - Real-time workflow visualization in incident modal
   - Phase-by-phase progress tracking
   - Command preview with risk assessment
   - Execution logs display
   - Verification results with health checks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌─────────────┐      ┌──────────────────────────────┐     │
│  │IncidentCard │─────▶│IncidentModal (AgentWorkflow) │     │
│  │   🤖 icon   │      │   - Start Remediation Button  │     │
│  └─────────────┘      │   - Phase Visualization       │     │
│                       │   - Real-time Polling         │     │
│                       └──────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API + WebSocket
┌────────────────────────────▼────────────────────────────────┐
│                    Backend (Go)                              │
│  ┌──────────────────┐    ┌──────────────────────────┐      │
│  │  Agent Service   │───▶│  Safety Service          │      │
│  │  - StartRemediation  │  │  - CanAgentActOnIncident │      │
│  │  - Multi-phase Flow  │  │  - System Whitelist      │      │
│  └──────────────────┘    └──────────────────────────┘      │
│           │                         │                        │
│           ▼                         ▼                        │
│  ┌──────────────────┐    ┌──────────────────────────┐      │
│  │ PostgreSQL DB    │    │ AI Diagnosis Service     │      │
│  │ - agent_executions │    │ - /agent-think endpoint  │      │
│  │ - JSONB fields   │    │ - Groq / Gemini          │      │
│  └──────────────────┘    └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### `agent_executions` Table

```sql
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id),
    status VARCHAR(50) NOT NULL,
    agent_model VARCHAR(100) NOT NULL,
    
    -- Phase 1: Thinking
    analysis TEXT,
    recommended_action VARCHAR(100),
    reasoning TEXT,
    
    -- Phase 2: Command Preview
    commands JSONB,
    risks JSONB,
    estimated_impact TEXT,
    
    -- Phase 3: Execution
    execution_logs JSONB,
    
    -- Phase 4: Verification
    verification_checks JSONB,
    verification_passed BOOLEAN,
    verification_notes TEXT,
    
    -- Completion
    success BOOLEAN,
    error_message TEXT,
    rollback_performed BOOLEAN DEFAULT false,
    dry_run BOOLEAN DEFAULT false,
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## API Endpoints

### Start Agent Remediation
```bash
POST /api/v1/incidents/:id/agent/remediate
```

**Response:**
```json
{
  "id": "uuid",
  "incident_id": "uuid",
  "status": "thinking",
  "agent_model": "gemini-2.5-flash",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Get Agent Execution
```bash
GET /api/v1/agent/executions/:executionId
```

### Get Incident Agent Executions
```bash
GET /api/v1/incidents/:id/agent/executions
```

## Usage

### Testing the Agent (CLI)

1. **Start all services:**
```bash
docker-compose up -d
```

2. **Run the test script:**
```bash
./scripts/test-agent.sh
```

This will:
- Break Redis to create a real incident
- Start AI agent remediation
- Monitor progress through all phases
- Display results

### Using the Frontend UI

1. **Break Redis to create an incident:**
```bash
./scripts/break-redis-fast.sh
```

2. **Open the incident in the UI:**
   - Look for incidents with the 🤖 icon (Agent Ready)
   - Click to open the incident modal

3. **Start AI Agent Remediation:**
   - Scroll to the "AI Agent Remediation" section
   - Click "Start AI Agent Remediation"
   - Watch the workflow progress in real-time

4. **Monitor Progress:**
   - The UI polls every 2 seconds for updates
   - See analysis, commands, risks, execution logs, and verification

### Manual API Testing

```bash
# 1. Get incident ID
INCIDENT_ID=$(curl -s http://localhost:8080/api/v1/incidents | jq -r '.[0].id')

# 2. Start remediation
curl -X POST http://localhost:8080/api/v1/incidents/$INCIDENT_ID/agent/remediate

# 3. Get execution ID from response
EXECUTION_ID="<from-response>"

# 4. Monitor progress
watch -n 2 "curl -s http://localhost:8080/api/v1/agent/executions/$EXECUTION_ID | jq"
```

## Safety Configuration

### Adding New Actionable Systems

Edit `backend/internal/agent/registry.go`:

```go
var ActionableSystems = map[string]bool{
    "redis-test":    true,  // Existing
    "postgres-test": true,  // Add new system
    "kafka-dev":     true,  // Add new system
}
```

### Creating Incidents that Agents Can Act On

When creating incidents via API or health monitor:

```json
{
  "message": "Redis memory usage critical",
  "source": "redis-test",
  "incident_type": "real_system",     // Must be real_system
  "actionable": true,                  // Must be true
  "affected_systems": ["redis-test"],  // Must include actionable system
  "remediation_mode": "automated",     // Must be automated
  "metadata": {
    "health_monitor_version": "1.0"
  }
}
```

## Adding New Remediation Actions

### 1. Update the Agent Service

Edit `backend/internal/agent/agent_service.go`, function `generateCommands()`:

```go
case "restart_postgres":
    return []models.Command{
        {
            Name:        "Restart PostgreSQL",
            Command:     "docker",
            Args:        []string{"restart", "postgres-test"},
            Target:      "postgres-test",
            Description: "Restart PostgreSQL container",
        },
    },
    "PostgreSQL will be unavailable for 2-3 seconds.",
    []models.Risk{
        {Level: "high", Description: "Brief service interruption", Mitigation: "Application has connection pooling"},
    }
```

### 2. Update the Execution Logic

Add handler in `executeCommand()`:

```go
if cmd.Target == "postgres-test" {
    // Call health-monitor or directly execute command
    // Return output or error
}
```

### 3. Update Verification Checks

Add verification in `runVerificationChecks()`:

```go
if action == "restart_postgres" {
    // Check PostgreSQL health
    // Return verification checks
}
```

## Monitoring & Debugging

### Backend Logs
```bash
docker logs backend -f
```

Look for:
- `🤖 [Agent] Starting remediation workflow`
- `🧠 [Agent] Phase 1: Thinking...`
- `📋 [Agent] Phase 2: Generating command preview...`
- `⚡ [Agent] Phase 3: Executing commands...`
- `🔍 [Agent] Phase 4: Verifying remediation...`
- `✅ [Agent] Remediation completed successfully`

### Database Queries
```sql
-- Get all agent executions
SELECT id, incident_id, status, success, created_at 
FROM agent_executions 
ORDER BY created_at DESC;

-- Get execution details
SELECT * FROM agent_executions 
WHERE id = 'execution-uuid';

-- Get failed executions
SELECT * FROM agent_executions 
WHERE success = false;
```

### Health Monitor Status
```bash
curl http://localhost:8002/status | jq
```

## Troubleshooting

### Agent Won't Start

**Error:** "agent cannot act on this incident"

**Solutions:**
1. Check incident is marked as `actionable: true`
2. Verify `incident_type: "real_system"`
3. Ensure `remediation_mode: "automated"`
4. Confirm `affected_systems` includes a system in the whitelist

### Agent Stuck in Thinking Phase

**Possible causes:**
- AI service is down
- Network connectivity issues

**Debug:**
```bash
# Check AI service
docker logs ai-diagnosis -f

# Test AI endpoint directly
curl -X POST http://localhost:8001/api/v1/agent-think \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test"}'
```

### Commands Fail to Execute

**Debug:**
```bash
# Check execution logs in database
SELECT execution_logs FROM agent_executions WHERE id = 'uuid';

# Check health-monitor
curl http://localhost:8002/status
```

### Verification Fails

The agent will complete but mark `success: false` if verification fails. This is expected behavior - the agent attempted remediation but the system health didn't improve.

**Next steps:**
- Review verification checks
- Check system logs
- May require manual intervention

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Manual approval step (remove auto-approval)
- [ ] Rollback capability on failure
- [ ] Dry-run mode testing

### Phase 2 (Near-term)
- [ ] More sophisticated Redis actions (scale, failover)
- [ ] PostgreSQL remediation actions
- [ ] Kafka remediation actions
- [ ] Agent confidence scoring

### Phase 3 (Long-term)
- [ ] Multi-step remediation plans
- [ ] Learning from past remediations
- [ ] Integration with runbooks
- [ ] Notification system (Slack, PagerDuty)

## Security Considerations

1. **Whitelist Approach**: Only explicitly allowed systems can be acted upon
2. **Incident Classification**: Triple verification (actionable, incident_type, remediation_mode)
3. **Audit Trail**: Full execution history stored in database
4. **Command Logging**: Every command and its output logged
5. **Verification**: Always verify remediation worked
6. **Isolation**: Agent only has access to test/development systems

## Contributing

When adding new agent actions:
1. Update `registry.go` with new system
2. Add command generation in `agent_service.go`
3. Implement execution logic
4. Add verification checks
5. Update this documentation
6. Test in isolated environment first

## License

Part of the Incident Management Simulator project.

