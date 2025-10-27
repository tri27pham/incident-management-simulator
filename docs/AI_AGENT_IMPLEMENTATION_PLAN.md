# 🤖 AI Agent Self-Healing System - Complete Implementation Plan

## 📋 Executive Summary

Build an AI-powered incident management system where:
1. **Real services** (Redis, PostgreSQL) run in Docker containers
2. **Incident Generator** intentionally breaks these services
3. **Health Monitor** detects failures and creates incidents
4. **AI Diagnosis** analyzes errors and suggests solutions
5. **AI Agent** executes real shell commands to fix the problems
6. **Frontend** displays commands in real-time (like Cursor IDE)
7. Users see exactly what the agent does, transparently

---

## 🏗️ System Architecture

### EXISTING SYSTEM (Already built and working)
- Frontend (React/TypeScript) - Port 5173
- Backend API (Go/Gin) - Port 8080
- AI Diagnosis Service (Python/FastAPI) - Port 8000
- PostgreSQL Database - Port 5432
- Incident Generator - Port 9000

### NEW COMPONENTS (To be built)

#### 1. Mock Services (Real Docker containers that can fail)
- **Redis (Port 6380)** - Memory exhaustion, connection issues
- **PostgreSQL (Port 5433)** - Connection pool, slow queries

#### 2. Health Monitor Service (Python/FastAPI) - No external port
- Polls mock services every 10 seconds
- Detects unhealthy states
- Creates incidents via Backend API

#### 3. AI Agent Service (Python/FastAPI) - Port 8001
- Proposes fix actions
- Executes real shell commands (docker exec, docker restart)
- Streams execution to frontend via WebSocket
- Verifies fixes worked

#### 4. Enhanced Frontend Components
- **AgentExecutionModal** - Shows real-time command execution
- **CommandLog** - Terminal-like display
- **SystemHealthBadge** - Shows mock service status

---

## 📊 Data Flow

### Complete Incident Lifecycle:

#### 1. FAILURE INJECTION
- User/Incident Generator → POST /inject-failure → Mock Service
- Mock service state changes to "broken"
- Health: 100% → 30%

#### 2. DETECTION (Every 10 seconds)
- Health Monitor → GET /health → Mock Service
- Detects health < 70%
- POST /api/v1/incidents → Backend API
  - Payload includes: message, source, affected_system, error_logs, metrics_snapshot

#### 3. INCIDENT CREATION
- Backend API → Saves to PostgreSQL
- Broadcasts via WebSocket to Frontend
- Frontend shows new incident card

#### 4. AI DIAGNOSIS (Automatic)
- Backend → POST /api/v1/diagnosis → AI Diagnosis Service
- AI analyzes error_logs + metrics
- Returns diagnosis (e.g., "Redis memory pool is exhausted")
- Backend saves diagnosis to DB
- Broadcasts update to Frontend

#### 5. AI SOLUTION (User-triggered)
- User clicks "Get AI Solution"
- Frontend → Backend → AI Diagnosis Service
- AI suggests solution (e.g., "Clear Redis cache to free memory")
- Backend saves solution to DB
- Broadcasts update to Frontend

#### 6. AGENT FIX PROPOSAL (User-triggered)
- User clicks "Get AI Agent Fix"
- Frontend → Backend → POST /propose-fix → AI Agent Service
- Agent analyzes incident.error_logs
- Determines action: "flush" (clear all Redis data)
- Returns: action, risk level, command_preview, details
- Frontend shows approval modal with command preview

#### 7. AGENT EXECUTION (User approves)
- User clicks "Approve & Execute"
- Frontend opens WebSocket to Agent
- Frontend → WS /ws/execute-fix → AI Agent Service

**Agent streams phases:**

**Phase 1 - THINKING:**
- "Analyzing incident..."
- "Error: OOM command not allowed"
- "Proposed action: FLUSH"

**Phase 2 - COMMAND PREVIEW:**
- Shows full command to be executed
- Status: "pending"

**Phase 3 - EXECUTION:**
- Executes: docker exec redis-test redis-cli FLUSHALL
- Streams status: "running"
- Returns: exit code, stdout, stderr, duration

**Phase 4 - VERIFICATION:**
- Checks health after fix
- Executes: docker exec redis-test redis-cli INFO memory
- Parses output to calculate new health %

**Phase 5 - COMPLETION:**
- Logs action to backend: POST /api/v1/incidents/{id}/actions
- Updates incident status: PATCH /api/v1/incidents/{id} → "resolved"
- Streams completion with health before/after

---

## 🗄️ Database Schema Changes

### New Fields for `incidents` Table:
- `affected_system` VARCHAR(100) - Which mock system: redis-test, postgres-test
- `error_logs` TEXT - JSON array of error messages from the system
- `metrics_snapshot` JSONB - System metrics at time of failure

### New Table: `agent_actions`
Tracks every action the agent takes on incidents.

**Fields:**
- `id` UUID PRIMARY KEY
- `incident_id` UUID FOREIGN KEY → incidents(id)
- `action` VARCHAR(50) - Action type: 'flush', 'restart', 'kill-connections'
- `command` TEXT - Actual shell command executed
- `executed_at` TIMESTAMP
- `result` VARCHAR(20) - 'success' or 'failed'
- `exit_code` INTEGER - Command exit code
- `stdout` TEXT - Command output
- `stderr` TEXT - Command errors
- `duration_ms` INTEGER - How long it took
- `health_before` INTEGER - Health % before action
- `health_after` INTEGER - Health % after action

**Indexes:**
- idx_agent_actions_incident (incident_id)
- idx_agent_actions_executed (executed_at DESC)

---

## 📁 Project Structure

```
incident-management-simulator/
├── backend/
│   ├── internal/
│   │   ├── models/
│   │   │   ├── incident.go          # Add affected_system, error_logs, metrics_snapshot
│   │   │   └── agent_action.go      # NEW - AgentAction model
│   │   ├── handlers/
│   │   │   └── incident_handler.go  # Add agent action endpoints
│   │   └── services/
│   │       └── incident_service.go  # Add CreateAgentAction()
│   └── migrations/
│       ├── 03-add-agent-fields.sql  # NEW
│       └── 04-create-agent-actions.sql  # NEW
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AgentExecutionModal.tsx    # NEW - Main agent UI
│       │   ├── CommandLog.tsx             # NEW - Terminal display
│       │   ├── SystemHealthBadge.tsx      # NEW - Shows system status
│       │   └── IncidentModal.tsx          # Add "Get AI Agent Fix" button
│       ├── services/
│       │   └── api.ts                     # Add agent API calls
│       └── types.ts                       # Add agent types
│
├── mock-services/              # NEW DIRECTORY
│   ├── redis-test/
│   │   ├── Dockerfile
│   │   └── redis.conf          # maxmemory 50mb
│   └── postgres-test/
│       ├── Dockerfile
│       └── postgresql.conf     # max_connections=20
│
├── health-monitor/             # NEW SERVICE
│   ├── app.py                  # FastAPI service
│   ├── monitors/
│   │   ├── base_monitor.py
│   │   ├── redis_monitor.py
│   │   └── postgres_monitor.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── ai-agent/                   # NEW SERVICE
│   ├── app.py                  # FastAPI + WebSocket
│   ├── executors/
│   │   ├── base.py             # Abstract executor interface
│   │   ├── docker_executor.py # For local dev
│   │   └── k8s_executor.py    # For GKE (optional)
│   ├── proposers/
│   │   └── fix_proposer.py    # Determines which action to take
│   ├── verifiers/
│   │   └── health_verifier.py # Checks if fix worked
│   ├── Dockerfile
│   └── requirements.txt
│
└── docker-compose.yml          # Add new services
```

---

## 🔧 Component Specifications

### 1. Mock Services

#### Redis Test Container
**Purpose:** Real Redis instance with memory limits that can be intentionally broken

**Configuration:**
- Image: redis:7-alpine
- Port: 6380
- Max memory: 50mb
- Max memory policy: noeviction (causes OOM errors instead of evicting)
- Memory limit: 100mb

**Health Check:**
Command: `docker exec redis-test redis-cli INFO memory`
Parse: used_memory, maxmemory
Calculate: `health = 100 - (used_memory / maxmemory * 100)`

**Failure Scenarios:**
1. **Memory Exhaustion (OOM)**
   - Fill Redis with data until used_memory = maxmemory
   - Error: "OOM command not allowed when used memory > 'maxmemory'"
   - Fix: docker exec redis-test redis-cli FLUSHALL

2. **Connection Limit (Future)**
   - Max clients reached
   - Fix: docker restart redis-test

#### PostgreSQL Test Container
**Purpose:** Real PostgreSQL instance with connection limits

**Configuration:**
- Image: postgres:16-alpine
- Port: 5433
- Max connections: 20
- Shared buffers: 128MB
- Memory limit: 256mb

**Health Check:**
Command: `docker exec postgres-test psql -U testuser -d testdb -c "SELECT count(*) FROM pg_stat_activity;"`
Calculate health based on connection usage

**Failure Scenarios:**
1. **Connection Pool Exhaustion**
   - Open 20 connections and hold them
   - Error: "FATAL: sorry, too many clients already"
   - Fix: Kill idle connections via SQL query

2. **Restart (General)**
   - Fix: docker restart postgres-test

---

### 2. Health Monitor Service

**Purpose:** Poll mock services, detect failures, create incidents

**Tech Stack:**
- Python 3.11
- FastAPI (for optional status endpoint)
- APScheduler (for polling every 10 seconds)
- docker-py (to exec into containers)
- requests (to call Backend API)

**Key Functions:**

1. **check_redis_health(container_name)** → Returns health dict
   - Executes INFO memory command
   - Parses output
   - Calculates health percentage
   - Returns: healthy (bool), health (int), metrics (dict), error_logs (list)

2. **check_postgres_health(container_name)** → Returns health dict
   - Executes connection count query
   - Calculates health percentage
   - Returns same structure as Redis

3. **check_all_services()** → Runs on schedule
   - Loops through all configured services
   - Calls appropriate health check function
   - If unhealthy, calls create_incident()

4. **create_incident(service_name, health_data)** → Creates incident
   - Builds incident payload with error_logs and metrics
   - POST to Backend API /api/v1/incidents
   - Logs result

**Service Configuration:**
Dictionary mapping service names to check commands and thresholds:
- redis-test: type=redis, threshold=70%, command=["redis-cli", "INFO", "memory"]
- postgres-test: type=postgres, threshold=70%, command=[psql query]

**Scheduler:**
- Uses APScheduler with AsyncIOScheduler
- Interval: 10 seconds
- Starts on FastAPI startup event

---

### 3. AI Agent Service

**Purpose:** Propose fixes, execute shell commands, stream to frontend

**Tech Stack:**
- Python 3.11
- FastAPI + WebSockets
- subprocess (for shell commands)
- docker-py (for container operations)

**Endpoints:**

1. **POST /propose-fix**
   - Input: incident_id
   - Fetches incident from Backend API
   - Analyzes affected_system and error_logs
   - Uses rule-based logic to determine action
     - Redis + "OOM" → action="flush"
     - Redis + other → action="restart"
     - Postgres + "too many clients" → action="kill-connections"
     - Postgres + other → action="restart"
   - Returns: action, command, description, risk, expected_result

2. **WebSocket /ws/execute-fix**
   - Accepts connection
   - Receives: incident_id, system, action
   - Streams phases in real-time:
     
     **THINKING Phase:**
     - "Analyzing incident..."
     - Shows system and proposed action
     
     **COMMAND Phase:**
     - Shows full command to be executed
     - Status: pending
     
     **EXECUTING Phase:**
     - Status: running
     - Executes subprocess command
     - Captures stdout, stderr, exit code, duration
     
     **RESULT Phase:**
     - Shows command result
     - Status: completed or failed
     - Includes all execution details
     
     **VERIFYING Phase:**
     - Runs health check command
     - Parses output to get new health %
     
     **VERIFICATION Phase:**
     - Shows verification result
     - New health percentage
     
     **COMPLETE Phase:**
     - Logs action to Backend API
     - Updates incident status to resolved (if health > 80%)
     - Shows health before/after comparison

**Fix Actions Configuration:**
Dictionary mapping systems and actions to commands:
- redis-test:
  - flush: ["docker", "exec", "redis-test", "redis-cli", "FLUSHALL"]
  - restart: ["docker", "restart", "redis-test"]
- postgres-test:
  - kill-connections: [docker exec postgres-test psql ... pg_terminate_backend]
  - restart: ["docker", "restart", "postgres-test"]

Each action includes: command, description, risk level, expected result

---

### 4. Backend Changes

#### New Model: agent_action.go
- Struct matching agent_actions table schema
- JSON tags for API responses
- GORM tags for database mapping

#### Update: incident.go
- Add fields: AffectedSystem, ErrorLogs, MetricsSnapshot
- Add relationship: AgentActions []AgentAction

#### New Handlers:
- **CreateAgentActionHandler(c *gin.Context)**
  - POST /api/v1/incidents/:id/actions
  - Accepts action details
  - Saves to agent_actions table
  - Returns created action

- **GetAgentActionsHandler(c *gin.Context)**
  - GET /api/v1/incidents/:id/actions
  - Returns all actions for an incident

#### Router Updates:
- Add POST /incidents/:id/actions → CreateAgentActionHandler
- Add GET /incidents/:id/actions → GetAgentActionsHandler

#### Migration Files:
- **03-add-agent-fields.sql**: ALTER TABLE incidents ADD COLUMN...
- **04-create-agent-actions.sql**: CREATE TABLE agent_actions...

---

### 5. Frontend Changes

#### New Types (types.ts)

**AgentAction interface:**
- id, incident_id, action, command
- executed_at, result, exit_code
- stdout, stderr, duration_ms
- health_before, health_after

**Incident interface updates:**
- Add: affected_system, error_logs, metrics_snapshot, agent_actions[]

**AgentExecutionPhase interface:**
- phase: 'thinking' | 'command' | 'executing' | 'result' | 'verifying' | 'verification' | 'complete' | 'error'
- command, status, message
- stdout, stderr, exit_code, duration
- health, health_before, health_after, timestamp

#### New Component: AgentExecutionModal.tsx

**Purpose:** Display real-time command execution like a terminal

**State:**
- logs: AgentExecutionPhase[] - Accumulates all phases
- currentPhase: string - Current execution phase
- isComplete: boolean - Whether execution finished
- wsRef: WebSocket - Connection to agent service

**Lifecycle:**
1. Opens WebSocket to ws://localhost:8001/ws/execute-fix
2. Sends fix request with incident_id, system, action
3. Receives phase updates via WebSocket
4. Appends each phase to logs array
5. Auto-scrolls to bottom as new logs arrive
6. Shows completion status

**UI Structure:**
- Header: Title + close button
- Main area: Scrollable log entries
- Footer: Current phase indicator + close button (when complete)

**LogEntry Component:**
Each phase renders differently:
- **Thinking**: Blue background, thought icon 💭, message
- **Command/Executing**: Gray background, terminal icon 🔧, command in monospace, status
- **Result**: Green (success) or red (failed) background, exit code, stdout/stderr
- **Verification**: Purple background, health icon 🩺, health percentage
- **Complete**: Green (success) or red (failed), health comparison
- **Error**: Red background, warning icon ⚠️

#### Update: IncidentModal.tsx
- Add "Get AI Agent Fix" button (visible when incident has solution)
- Button triggers opening of AgentExecutionModal
- Orange styling with lightning icon

#### Update: api.ts
- Add proposeAgentFix(incidentId) function
- Add getAgentActions(incidentId) function
- WebSocket connection handled in component

---

## 🔄 docker-compose.yml Updates

Add new services to existing docker-compose.yml:

**redis-test:**
- Image: redis:7-alpine
- Port mapping: 6380:6379
- Command: redis-server --maxmemory 50mb --maxmemory-policy noeviction
- Memory limit: 100m

**postgres-test:**
- Image: postgres:16-alpine
- Port mapping: 5433:5432
- Environment: testuser, testpass, testdb
- Command: postgres -c max_connections=20
- Memory limit: 256m

**health-monitor:**
- Build: ./health-monitor
- Environment: BACKEND_URL=http://backend:8080
- Volumes: /var/run/docker.sock (to exec into containers)
- Depends on: redis-test, postgres-test, backend

**ai-agent:**
- Build: ./ai-agent
- Port mapping: 8001:8001
- Environment: BACKEND_URL=http://backend:8080
- Volumes: /var/run/docker.sock (to exec commands)
- Depends on: backend

All services on same network: incident-net

---

## 📅 Implementation Timeline

### Day 1 (6 hours) - Mock Services + Health Monitor

**Hour 1: Setup Mock Services**
- Add redis-test and postgres-test to docker-compose.yml
- Test containers start successfully
- Verify basic connectivity (PING, psql connection)

**Hour 2: Create Health Monitor Structure**
- Create health-monitor/ directory
- Set up app.py skeleton with FastAPI
- Create Dockerfile
- Create requirements.txt

**Hour 3-4: Implement Redis Health Check**
- Implement check_redis_health() function
- Parse INFO memory output
- Calculate health percentage
- Test: Manually fill Redis, verify health calculation

**Hour 5: Implement Incident Creation**
- Implement create_incident() function
- Test POST to Backend API
- Test end-to-end: Fill Redis → Health drops → Incident created → Shows in frontend

**Hour 6: Test & Debug**
- Fill Redis until OOM error
- Verify health monitor detects it within 10 seconds
- Verify incident appears in frontend with correct data
- Debug any issues

**Deliverable:** ✅ Redis breaks, health monitor automatically creates incidents

---

### Day 2 (12 hours) - AI Agent + Frontend

**Hour 1-2: AI Agent Service Structure**
- Create ai-agent/ directory
- Set up app.py with FastAPI + WebSocket imports
- Create Dockerfile, requirements.txt
- Create FIX_ACTIONS configuration dictionary
- Test basic FastAPI startup

**Hour 3-4: Implement /propose-fix Endpoint**
- Implement endpoint to fetch incident from backend
- Implement rule-based action selection logic
- Test: Send incident_id, verify correct action returned
- Test different error types (OOM vs connection exhaustion)

**Hour 5-7: Implement WebSocket Execution**
- Implement /ws/execute-fix WebSocket endpoint
- Implement phase streaming (thinking, command, executing, etc.)
- Implement subprocess command execution
- Implement health verification
- Test: Connect, send request, verify phases stream correctly

**Hour 8-9: Backend Integration**
- Create migration files (03, 04)
- Update incident.go model with new fields
- Create agent_action.go model
- Implement CreateAgentActionHandler
- Update router with new endpoints
- Run migrations
- Test: Agent logs actions to database

**Hour 10-12: Frontend AgentExecutionModal**
- Create AgentExecutionModal component
- Implement WebSocket connection logic
- Implement log accumulation and display
- Create LogEntry component with phase-specific rendering
- Style with terminal-like appearance
- Add "Get AI Agent Fix" button to IncidentModal
- Test: Click button → Modal opens → Commands stream → Modal closes
- Add auto-scroll functionality

**Deliverable:** ✅ Full cycle works: Break Redis → Click "Get AI Agent Fix" → See commands execute → Redis fixed → Incident resolved

---

### Day 3 (4-5 hours) - Polish + PostgreSQL

**Hour 1-2: Add PostgreSQL Support**
- Implement check_postgres_health() in health monitor
- Add connection exhaustion scenario
- Implement kill-connections fix action in agent
- Add to FIX_ACTIONS configuration
- Test end-to-end with Postgres

**Hour 3-4: Error Handling**
- Handle command execution failures gracefully
- Display stderr in UI clearly
- Add retry logic for transient failures
- Add fallback actions (if flush fails, try restart)
- Test failure scenarios

**Hour 5: Testing & Bug Fixes**
- Test all failure scenarios for both Redis and Postgres
- Test agent success paths
- Test agent failure paths
- Fix any bugs discovered
- Performance testing

**Deliverable:** ✅ Two working services with robust error handling

---

### Day 4-5 (8-10 hours) - Documentation + Demo + Optional Features

**Hour 1-3: Documentation**
- Update README with agent information
- Document all failure scenarios
- Document all fix commands
- Create architecture diagrams
- Document troubleshooting steps

**Hour 4-6: Demo Preparation**
- Clean up logs and debugging code
- Create demo script with step-by-step instructions
- Record demo video showing full lifecycle
- Prepare presentation slides
- Test demo flow multiple times

**Hour 7-10: Optional Enhancements**

**Option A: GKE Deployment**
- Create Kubernetes manifests
- Implement k8s_executor.py
- Deploy to GKE
- Test in production environment

**Option B: More Failure Types**
- Add disk space exhaustion
- Add network latency injection
- Add CPU throttling

**Option C: AI-Powered Action Selection**
- Integrate Groq/Gemini for action selection
- Replace rule-based logic with AI analysis
- Test AI decision-making

**Deliverable:** ✅ Production-ready demo with comprehensive documentation

---

## 🎯 Success Criteria

### MVP Requirements (Must Have):
✅ Redis container that can be broken (OOM)
✅ Health monitor detects failures automatically
✅ Incidents created automatically with error details
✅ AI Agent proposes fix actions based on error analysis
✅ Agent executes real shell commands (not simulated)
✅ Commands visible in real-time with terminal-like UI
✅ Verification confirms fix worked (health check)
✅ Incident marked as resolved automatically
✅ All agent actions logged to database

### Nice to Have:
✅ PostgreSQL as second service
✅ Multiple failure types per service
✅ Comprehensive error handling and retry logic
✅ AI-powered action selection (via Groq/Gemini)
✅ GKE deployment with Kubernetes executor
✅ User approval workflow before execution
✅ Rollback capability if fix fails

---

## 🚨 Risk Mitigation

### Risk: Docker socket access in containers
**Problem:** Health monitor and agent need to exec into containers
**Solution:** Mount Docker socket: /var/run/docker.sock:/var/run/docker.sock
**Security Note:** This gives containers full Docker access. Safe for local dev, use RBAC for production.

### Risk: WebSocket connection issues
**Problem:** Real-time streaming may have connectivity issues
**Solution:** 
- Test WebSocket locally before integrating
- Add reconnection logic with exponential backoff
- Add connection status indicator in UI
- Fallback to polling if WebSocket fails

### Risk: Command execution failures
**Problem:** Shell commands may fail unexpectedly
**Solution:**
- Comprehensive error handling with try-catch
- Always capture stderr
- Display errors clearly in UI
- Add timeout for long-running commands
- Add fallback actions

### Risk: Health check false positives
**Problem:** Service may be unhealthy but health check passes
**Solution:**
- Use multiple health indicators
- Add threshold buffer (e.g., wait for 2 consecutive failures)
- Add manual trigger option for users

### Risk: Running out of time
**Problem:** Ambitious scope for limited time
**Solution:**
- Focus on Redis only first (skip Postgres if needed)
- Use simple rule-based action selection (skip AI-powered)
- Deploy locally only (skip GKE if needed)
- Prioritize working demo over polish

### Risk: Database migration issues
**Problem:** Schema changes may fail or cause data loss
**Solution:**
- Test migrations on fresh database first
- Make all changes backwards-compatible (use IF NOT EXISTS)
- Keep backup of existing data
- Document rollback procedures

---

## 📦 Handoff Checklist

### Prerequisites:
✅ Existing incident management system (already built and working)
✅ Docker installed and running (Docker Desktop on Mac)
✅ Python 3.11+ for new services
✅ Go 1.21+ for backend updates
✅ Node.js 18+ for frontend updates
✅ PostgreSQL 16+ for main database
✅ 25+ GB free disk space

### Environment Variables:
Ensure .env file contains:
- GROQ_API_KEY (for AI diagnosis)
- BACKEND_URL=http://localhost:8080
- All existing database credentials

### Implementation Order:
1. **Start with Mock Services** - Get Redis and Postgres containers running
2. **Build Health Monitor** - Detect when services break
3. **Create Agent Service** - Execute fix commands
4. **Update Backend** - Add models, handlers, migrations
5. **Build Frontend UI** - Real-time command display
6. **Test End-to-End** - Break services, watch agent fix them
7. **Document & Demo** - Prepare for presentation

### Testing Strategy:
1. Unit test each component individually
2. Integration test service-to-service communication
3. End-to-end test full incident lifecycle
4. Load test with multiple simultaneous incidents
5. Failure test with unexpected errors

### Key Files to Create:
- health-monitor/app.py
- ai-agent/app.py
- backend/internal/models/agent_action.go
- backend/migrations/03-add-agent-fields.sql
- backend/migrations/04-create-agent-actions.sql
- frontend/src/components/AgentExecutionModal.tsx
- mock-services/redis-test/Dockerfile
- mock-services/postgres-test/Dockerfile
- Update: docker-compose.yml

### Validation Steps:
1. ✅ Can manually break Redis (fill until OOM)
2. ✅ Health monitor detects failure within 10 seconds
3. ✅ Incident appears in frontend automatically
4. ✅ AI diagnosis and solution generate successfully
5. ✅ "Get AI Agent Fix" button appears
6. ✅ Clicking button opens modal with real-time commands
7. ✅ Commands execute successfully
8. ✅ Verification shows improved health
9. ✅ Incident status changes to resolved
10. ✅ Agent action logged in database

---

## 🎓 Learning Outcomes

By completing this implementation, you will gain hands-on experience with:

- **Microservices Architecture** - Multiple services communicating via APIs
- **WebSocket Real-Time Communication** - Streaming data to frontend
- **Container Orchestration** - Managing multiple Docker containers
- **Health Monitoring** - Proactive detection of system failures
- **Automated Remediation** - Self-healing systems
- **Shell Command Execution** - Subprocess management in Python
- **Database Migrations** - Evolving schema safely
- **Go Backend Development** - API handlers and models
- **React Frontend Development** - Complex UI components
- **TypeScript Type Safety** - Interfaces and type checking
- **Error Handling** - Graceful degradation and recovery
- **DevOps Practices** - Logging, monitoring, troubleshooting

---

## 🚀 Next Steps After MVP

Once the basic system is working, consider these enhancements:

1. **More Mock Services**
   - Kafka message broker
   - Elasticsearch cluster
   - MongoDB database
   - Nginx web server

2. **More Failure Types**
   - Disk space exhaustion
   - Network latency/partitions
   - CPU throttling
   - Memory leaks
   - Corrupted data

3. **AI Enhancements**
   - Use Groq/Gemini to analyze logs and determine actions
   - Learn from past successful fixes
   - Suggest preventive measures
   - Generate incident reports

4. **Production Features**
   - User approval workflow (require confirmation before executing)
   - Rollback capability (undo if fix makes things worse)
   - Audit trail (track all actions for compliance)
   - Alerting (notify users of critical incidents)
   - Metrics dashboard (track MTTR, success rate, etc.)

5. **GKE Deployment**
   - Kubernetes manifests for all services
   - Horizontal pod autoscaling
   - Persistent volume claims
   - Ingress controllers
   - CI/CD pipeline

---

## 📚 References

### Docker Commands
- `docker exec <container> <command>` - Execute command in running container
- `docker restart <container>` - Restart a container
- `docker logs <container>` - View container logs
- `docker inspect <container>` - Get detailed container info

### Redis Commands
- `redis-cli INFO memory` - Get memory usage
- `redis-cli FLUSHALL` - Clear all data
- `redis-cli CONFIG GET maxmemory` - Get memory limit

### PostgreSQL Commands
- `psql -U user -d db -c "query"` - Execute SQL query
- `pg_stat_activity` - View active connections
- `pg_terminate_backend(pid)` - Kill a connection

### Useful Tools
- `docker-compose up -d` - Start all services in background
- `docker-compose logs -f <service>` - Follow service logs
- `docker-compose down` - Stop all services
- `docker-compose restart <service>` - Restart specific service

---

**This document contains everything needed to understand and implement the AI Agent Self-Healing System!** 🎯

**Total Estimated Time:** 30-35 hours (MVP + documentation + demo)
**Minimum Viable Product:** 20-25 hours (Redis only, basic UI)
**Time Available:** 27 hours (based on user's schedule)

**Recommendation:** Focus on MVP first, add enhancements if time permits. 🚀

