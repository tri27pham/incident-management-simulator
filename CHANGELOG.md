# Changelog

## [Unreleased] - AI Agent Remediation System

### 🤖 Major Features Added

#### AI Agent Automated Remediation
- Complete multi-phase workflow for automated incident resolution
- AI analyzes incidents, generates remediation plans, and executes fixes
- User approval required before any automated actions
- Full audit trail and execution logging
- Automatic incident resolution on successful remediation
- Real-time workflow visualization in UI

#### Incident Classification System
- New incident types: `real_system`, `synthetic`, `training`
- Actionability flags to control which incidents agents can act on
- Affected systems tracking with array field
- Remediation modes: `automated`, `manual`, `advisory`
- Safety service enforces strict rules before agent actions
- System registry whitelist for approved systems

### 🎨 Frontend Enhancements

#### UI Components
- Agent remediation section in incident modal
- Classification badges (🤖 Agent Ready, 📝 Synthetic)
- Real-time workflow visualization with phase indicators
- Loading animations during AI thinking phase
- Approval/rejection interface with risk assessment
- Collapsible sections for diagnosis, solution, and agent info
- Collapsible cancelled executions for cleaner history
- Execution logs with command output display
- Verification results with health check details

#### Layout Improvements
- Swapped modal columns (Info left, AI sections right)
- Scrollable agent remediation section
- Better spacing and visual hierarchy
- Theme-aware styling for light/dark modes
- Full-width orange "Start AI Agent Remediation" button
- Bordered "Automated" badge without emoji

#### Resolved Incidents Panel
- Shows complete agent execution history
- Agent information visible for agent-resolved incidents
- All remediation steps, logs, and verification displayed
- Fixed rendering issues with execution logs

### 🔧 Backend Enhancements

#### New Services
- **Agent Service**: Core remediation workflow orchestration
- **Safety Service**: Permission and safety rule enforcement
- **System Registry**: Whitelist of actionable systems

#### New API Endpoints
- `POST /api/v1/incidents/:id/agent/remediate` - Start agent remediation
- `GET /api/v1/agent/executions/:id` - Get execution details
- `GET /api/v1/incidents/:id/agent/executions` - Get all executions for incident
- `POST /api/v1/agent/executions/:id/approve` - Approve pending execution
- `POST /api/v1/agent/executions/:id/reject` - Reject pending execution
- `POST /api/v1/reset` - Database reset with frontend broadcast

#### AI Integration
- New `/api/v1/agent-think` endpoint in ai-diagnosis service
- Constrained AI prompts to only recommend implemented actions
- Support for Groq and Gemini models

### 💾 Database Changes

#### New Table: `agent_executions`
- Comprehensive tracking of all agent activities
- Multi-phase status tracking
- JSONB fields for flexible data storage (commands, risks, logs, verification)
- Complete audit trail with timestamps
- Success/failure tracking and error messages
- Rollback tracking (infrastructure ready)

#### Extended `incidents` Table
- `incident_type VARCHAR(50)` - Classification of incident
- `actionable BOOLEAN` - Can agents act on this?
- `affected_systems TEXT[]` - Array of impacted systems
- `remediation_mode VARCHAR(50)` - How to remediate
- `metadata JSONB` - Flexible additional data

#### Custom GORM Types
- `StringArray` for PostgreSQL `TEXT[]` arrays
- `JSONB` for PostgreSQL JSONB with proper marshaling/unmarshaling

### 🏥 System Monitoring

#### Health Monitor Service
- Continuous Redis memory monitoring
- Automatic incident creation when Redis exceeds thresholds
- Proper incident classification for agent compatibility
- Integration with agent service for command execution

#### UI Features
- System health dashboard with Redis metrics
- "Trigger Failure" button to simulate Redis overload
- Real-time health updates via polling
- Visual progress bar during failure simulation

### 🔄 Database Reset Improvements

#### Script Enhancements (`scripts/reset-db.sh`)
- Stops all services before clearing database
- Uses `TRUNCATE TABLE` with `RESTART IDENTITY CASCADE`
- Restarts services after reset
- Broadcasts reset event to frontend clients
- More reliable than previous DROP/CREATE approach

#### Frontend Reset Button
- Clears Redis memory
- Calls backend reset endpoint
- Backend truncates all tables
- Frontend receives WebSocket notification and clears UI
- Fixed duplicate `/api/v1` path issue

### 🐛 Bug Fixes

1. **GORM JSONB Scanning**: Fixed custom types to handle both objects and arrays
2. **WebSocket Status Updates**: Corrected incident status mapping for real-time updates
3. **Database Reset**: Fixed script to properly clear all data and stop services
4. **Frontend Reset URL**: Fixed duplicate `/api/v1` in reset endpoint call
5. **React Rendering**: Fixed execution logs rendering with proper type checking
6. **Z-index Issues**: Corrected overlapping UI elements in resolved panel
7. **Event Propagation**: Fixed click events bubbling in incident cards

### 🧪 Testing

#### New Scripts
- `scripts/test-agent.sh` - End-to-end agent workflow test
- `scripts/break-redis-fast.sh` - Quickly creates Redis incident for testing
- `scripts/start-docker.sh` - Simplified Docker Compose startup
- `scripts/stop-docker.sh` - Clean Docker Compose shutdown

### 📚 Documentation

#### New Documentation
- `AI_AGENT_README.md` - Complete AI agent system documentation
- Comprehensive PR description in markdown format
- Updated main `README.md` with AI agent features
- Updated `QUICK_REFERENCE.md` with new commands and troubleshooting

#### Documentation Improvements
- Architecture diagrams
- API documentation
- Usage instructions
- Troubleshooting guide
- Security considerations
- Extension guide for new actions
- Quick test walkthrough

### 🔒 Security Features

1. **Triple Verification**: Incident must be `actionable`, `real_system`, and `automated`
2. **System Whitelist**: Only explicitly allowed systems in registry
3. **User Approval**: Manual approval required before execution
4. **Audit Trail**: Complete history of all agent actions in database
5. **Verification**: Always checks if remediation actually worked
6. **Rollback Ready**: Infrastructure for future rollback capability

### ⚙️ Configuration

#### Environment Variables
- `HEALTH_MONITOR_URL` - Backend connection to health monitor service
- `VITE_API_URL` - Frontend API endpoint configuration

#### Docker Compose Updates
- Added health monitor service
- Added Redis test instance
- Network configuration for inter-service communication
- Build arguments for frontend configuration

### 🚀 Performance & Reliability

- Efficient database queries with proper indexing
- Connection pooling for health checks
- Graceful error handling and recovery
- Automatic WebSocket reconnection with exponential backoff
- Polling with configurable intervals (2s for agent executions)

### 📈 Metrics & Monitoring

- Agent execution success/failure rates tracked in database
- Complete execution logs for debugging
- Verification check results stored for analysis
- Timeline tracking for performance monitoring

---

## Migration Notes

### Database Migrations Required
```bash
./scripts/run-migrations.sh
```

### Docker Compose Changes
```bash
# Rebuild all services
docker-compose down
docker-compose up -d --build
```

### Environment Variables to Add
```env
HEALTH_MONITOR_URL=http://health-monitor:8002
```

---

## Breaking Changes

None - All changes are additive. Existing functionality remains unchanged.

---

## Rollback Plan

If issues arise, the system can be rolled back by:
1. Reverting database migrations (keep `agent_executions` table for audit)
2. Redeploying previous Docker images
3. Existing incidents and functionality continue to work

The agent system is completely opt-in and doesn't affect non-agent workflows.

