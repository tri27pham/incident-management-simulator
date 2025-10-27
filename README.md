# Incident Management Simulator

A full-stack application that simulates incident management with **AI-powered diagnosis**, **suggested solutions**, and **automated AI agent remediation** of real system incidents.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (running)
- Go 1.21+
- Node.js 18+
- Python 3.9+
- AI API Key (Groq or Gemini - see [Groq Setup](docs/GROQ_SETUP.md))

### Start Everything (Docker Compose - Recommended)
```bash
./scripts/start-docker.sh
```

This will:
1. Build and start all services in Docker containers
2. Run database migrations automatically
3. Start health monitoring for Redis
4. Make services available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - AI Diagnosis: http://localhost:8001
   - Health Monitor: http://localhost:8002

**Simpler and more reliable than running services individually!**

### Start Everything (Local Development)
```bash
./scripts/start.sh
```

This will:
1. Check if Docker is running
2. **Kill any conflicting services on ports 8080, 5173, 8000, 9000**
3. Start PostgreSQL in Docker
4. Clean up stale database connections
5. Run database migrations automatically
6. Start the backend (Go)
7. Start AI diagnosis service (FastAPI)
8. Start the frontend (React/Vite)
9. Start the incident generator (FastAPI)
10. Verify all services are healthy

**Note:** The script automatically handles port conflicts by killing old processes before starting new ones.

### Stop Everything
```bash
./scripts/stop.sh
```

This will:
1. Kill processes by PID files
2. **Kill any remaining processes on ports 8080, 5173, 8000, 9000** (catches orphaned processes)
3. Kill processes by name pattern (final fallback)
4. Stop PostgreSQL container
5. Clean up stale log files

**Note:** Uses a three-layer approach (PID → Port → Name) to ensure all services are stopped completely.

### Check Status
```bash
./scripts/status.sh
```

### View Logs
```bash
./scripts/logs.sh              # All logs
./scripts/logs.sh backend      # Backend only
./scripts/logs.sh frontend     # Frontend only
./scripts/logs.sh ai           # AI diagnosis only
./scripts/logs.sh generator    # Incident generator only
```

---

## 📊 Services

### Docker Compose (Recommended)
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React UI with incident board & AI agent controls |
| Backend API | http://localhost:8080 | Go API server with AI agent orchestration |
| AI Diagnosis | http://localhost:8001 | FastAPI AI service (Groq/Gemini) |
| Health Monitor | http://localhost:8002 | System health monitoring & incident creation |
| PostgreSQL | localhost:5432 | Database with agent execution tracking |
| Redis (Test) | localhost:6379 | Test system for AI agent remediation |

### Local Development
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | React UI (Vite dev server) |
| Backend API | http://localhost:8080 | Go API server |
| AI Diagnosis | http://localhost:8000 | FastAPI AI service |
| Incident Generator | http://localhost:9000 | Automated incident generation |
| PostgreSQL | localhost:5432 | Database |

---

## 🗄️ Database Management

### Clear All Incidents
```bash
./scripts/clear-db.sh
```
Deletes all incidents and agent executions but keeps schema intact.

### Reset Database (Nuclear)
```bash
./scripts/reset-db.sh
```
Truncates all tables (incidents, agent executions, analysis, status history) and broadcasts reset to all connected frontends. This is the recommended way to fully reset the system.

**Frontend Reset Button:** You can also use the "Reset" button in the UI which:
1. Clears Redis memory
2. Truncates all database tables
3. Clears the UI immediately

---

## 🔍 Troubleshooting

### Services Won't Start

The start script automatically handles most issues, but if you still have problems:

1. **Run stop.sh first:**
   ```bash
   ./scripts/stop.sh
   ```
   This uses a three-layer cleanup to ensure all old processes are killed.

2. **Check if Docker is running:**
   ```bash
   docker info
   ```
   If not, start Docker Desktop.

3. **Manually check for port conflicts:**
   ```bash
   lsof -ti:8080,5173,8000,9000,5432
   ```
   The start script should handle this automatically, but you can verify.

4. **Check logs:**
   ```bash
   ./scripts/logs.sh
   ```

**Note:** The start script now includes pre-flight checks that automatically kill conflicting processes.

### AI Diagnosis Not Working

1. **Check environment variables:**
   ```bash
   cat .env | grep -E "GROQ_API_KEY|GEMINI_API_KEY|AI_DIAGNOSIS_URL"
   ```
   At least one API key (Groq or Gemini) must be set.

2. **Verify AI service is responding:**
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

3. **Check backend has AI URL:**
   ```bash
   ./scripts/status.sh
   ```

4. **Test AI providers:**
   - Groq: Check API key at https://console.groq.com/keys
   - Gemini: Check API key at https://ai.google.dev/
   - See [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md) for detailed setup

### Database Connection Issues

1. **Check if PostgreSQL is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Start PostgreSQL:**
   ```bash
   docker start postgres-dev
   ```

3. **Test connection:**
   ```bash
   PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -c "\dt"
   ```

### "Datasource was invalidated" Error

This happens when your database client (like DBeaver) has stale connections.

**Fix:**
1. In DBeaver: Right-click connection → "Invalidate/Reconnect"
2. Or kill idle connections:
   ```bash
   PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'incident_db' AND pid <> pg_backend_pid() AND state = 'idle';"
   ```

---

## 🛠️ Manual Setup (Without Scripts)

If you prefer to run services manually:

### 1. Start PostgreSQL
```bash
docker run -d --name postgres-dev \
  -e POSTGRES_USER=incident_user \
  -e POSTGRES_PASSWORD=incident_pass \
  -e POSTGRES_DB=incident_db \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Start Backend
```bash
cd backend
AI_DIAGNOSIS_URL=http://localhost:8000 go run main.go
```

### 3. Start AI Diagnosis
```bash
cd ai-diagnosis
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
```

### 5. Start Incident Generator (Optional)
```bash
cd incident-generator
BACKEND_URL=http://localhost:8080 python3 app.py
```

---

## 📝 Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Or create a `.env` file in the project root:

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=incident_user
POSTGRES_PASSWORD=incident_pass
POSTGRES_DB=incident_db

# AI Services (at least one required)
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
AI_DIAGNOSIS_URL=http://localhost:8000

# Backend URL (for incident generator)
BACKEND_URL=http://localhost:8080

# Frontend URLs (optional)
VITE_API_URL=http://localhost:8080/api/v1
VITE_GENERATOR_URL=http://localhost:9000
```

**Note:** The system uses Groq as the primary AI provider with Gemini as fallback. At least one API key is required. See [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md) for setup instructions.

---

## 🎯 Features

### Core Features
- ✅ **Real-time incident board** with drag-and-drop workflow (Triage → Investigating → Fixing → Resolved)
- ✅ **AI-powered diagnosis** using Groq/Gemini with automatic fallback
- ✅ **AI-suggested solutions** with confidence scoring
- ✅ **WebSocket live updates** across all clients
- ✅ **Light/Dark theme** with smooth transitions
- ✅ **Status history tracking** with timeline visualization
- ✅ **Resolved incidents panel** with full incident history and agent execution details
- ✅ **Persistent notes** with manual save
- ✅ **Severity-based filtering** (Critical, High, Medium, Low, Minor)
- ✅ **Team-based filtering** (Backend, Frontend, Infrastructure, Database, Security)

### 🤖 AI Agent Remediation (NEW)
- ✅ **Incident Classification**: Real vs Synthetic incidents with actionability flags
- ✅ **Multi-phase workflow**: Analysis → Preview → Approval → Execution → Verification → Completion
- ✅ **User approval required**: Human oversight before any automated action
- ✅ **Safety controls**: Only acts on whitelisted systems with proper classification
- ✅ **Real-time visualization**: See agent progress with live updates
- ✅ **Execution logging**: Full audit trail of all commands and outputs
- ✅ **Health verification**: Confirms remediation actually fixed the issue
- ✅ **Auto-resolution**: Incidents automatically marked as resolved on success
- ✅ **Risk assessment**: Shows potential risks before execution
- ✅ **Rollback tracking**: Prepared for future rollback capability
- ✅ **Agent history**: View all past agent actions for each incident

### System Monitoring & Testing
- ✅ **Health monitoring**: Redis memory monitoring with automatic incident creation
- ✅ **Automated incident generation** via AI
- ✅ **Trigger failures**: UI buttons to simulate Redis overload
- ✅ **System health dashboard**: Real-time Redis metrics in UI

---

## 📦 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite, React Beautiful DnD
- **Backend:** Go, Gin, GORM, WebSockets
- **AI Service:** Python, FastAPI, Groq API, Google Gemini API
- **Database:** PostgreSQL 16 (with TimescaleDB-ready schema)
- **Containerization:** Docker, Docker Compose
- **Incident Generator:** Python, FastAPI, AI-powered

---

## 🔧 Development

### Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && go mod download

# AI Diagnosis
cd ai-diagnosis && pip install -r requirements.txt

# Incident Generator
cd incident-generator && pip install -r requirements.txt
```

### Run Tests

```bash
# Backend
cd backend && go test ./...

# Frontend
cd frontend && npm test
```

---

## 📄 License

MIT

---

## 🆘 Need Help?

1. Check `./scripts/status.sh` to see which services are running
2. Check logs with `./scripts/logs.sh`
3. Try stopping and restarting: `./scripts/stop.sh && ./scripts/start.sh`
4. For database issues: `./scripts/reset-db.sh` (⚠️ destroys all data)

---

## 📚 Documentation

- **[AI Agent System](./AI_AGENT_README.md)** - Complete AI agent remediation documentation
- [Quick Reference](docs/QUICK_REFERENCE.md) - Command cheatsheet
- [Groq Setup](docs/GROQ_SETUP.md) - Configure Groq AI
- [Migrations](docs/MIGRATIONS.md) - Database migration guide
- [AI Fallback Changes](docs/AI_FALLBACK_CHANGES.md) - AI provider fallback system

## 🚦 Quick Test: Try the AI Agent

1. **Start the system:**
   ```bash
   ./scripts/start-docker.sh
   ```

2. **Trigger a Redis incident:**
   - Click the "Trigger Failure" → "Overload Redis Memory" button in the UI
   - Or run: `./scripts/break-redis-fast.sh`

3. **Watch the AI agent work:**
   - Find the incident with the 🤖 "Agent Ready" badge
   - Click to open the incident modal
   - Scroll to "AI Agent Remediation"
   - Click "Start AI Agent Remediation"
   - Watch as the AI:
     - Analyzes the incident (10-15 seconds)
     - Generates a remediation plan
     - Waits for your approval
     - Executes the fix
     - Verifies it worked
     - Auto-resolves the incident

4. **View results:**
   - Check "View Resolved" to see the completed incident
   - All agent actions are logged and visible
