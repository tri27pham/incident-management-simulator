# Incident Management Simulator - Technical Report

**Version:** 1.0  
**Date:** November 12, 2025  
**Author:** System Architecture Documentation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Service Breakdown](#service-breakdown)
5. [Data Flow & Communication](#data-flow--communication)
6. [Database Architecture](#database-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [AI Services](#ai-services)
10. [Mock Systems & Failure Injection](#mock-systems--failure-injection)
11. [Deployment Architecture](#deployment-architecture)
12. [Design Decisions](#design-decisions)

---

## Executive Summary

The Incident Management Simulator is a full-stack microservices application designed to simulate real-world incident management workflows. It features:

- **AI-Powered Diagnosis**: Automated incident analysis using Groq/Gemini
- **Failure Injection**: Controlled breaking of mock systems (Redis, PostgreSQL, Disk)
- **Autonomous SRE Agent**: AI agent that diagnoses and fixes issues
- **Real-Time Updates**: WebSocket-based live incident board
- **Production Deployment**: Hosted on GCP with HTTPS and custom domain

**Key Metrics:**
- **Services**: 8 microservices
- **Languages**: Go, Python, TypeScript
- **Database**: PostgreSQL with GORM ORM
- **Deployment**: GCP Compute Engine (e2-medium)
- **Availability**: 24/7 accessible via https://incidentsimulator.net

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
│                            ↓                                    │
│                   incidentsimulator.net                         │
│                   (DNS → GCP VM IP)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               GCP Compute Engine (e2-medium)                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           Nginx Reverse Proxy (SSL/TLS)                   │ │
│  │  Port 80 → 443 redirect | Port 443 HTTPS                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Docker Compose Network                       │ │
│  │                                                           │ │
│  │  Frontend(3000) ←→ Backend(8080) ←→ PostgreSQL(5432)    │ │
│  │                        ↓                                  │ │
│  │                   AI Diagnosis(8000)                      │ │
│  │                   Incident Generator(8001)                │ │
│  │                   Health Monitor(8002)                    │ │
│  │                        ↓                                  │ │
│  │             Redis Mock(6379) | Postgres Mock(5433)       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          External: Groq API, Gemini API, GCP Secret Manager
```

### Microservices Overview

| Service | Technology | Port | Purpose | Container |
|---------|-----------|------|---------|-----------|
| Frontend | React+Vite+Nginx | 3000 | UI & incident board | ✅ |
| Backend | Go+Gin+GORM | 8080 | REST API, WebSocket hub | ✅ |
| AI Diagnosis | Python+FastAPI | 8000 | AI incident analysis | ✅ |
| Incident Generator | Python+FastAPI | 8001 | Auto-generate incidents | ✅ |
| Health Monitor | Python+Flask | 8002 | Monitor mock systems | ✅ |
| PostgreSQL (Main) | PostgreSQL 15 | 5432 | Primary database | ✅ |
| Redis Mock | Redis 7 | 6379 | Test system | ✅ |
| PostgreSQL Mock | PostgreSQL 15 | 5433 | Test system | ✅ |

---

## Technology Stack

### Frontend Stack

**Core:**
- **React 18**: UI framework with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework

**Key Libraries:**
- `react-beautiful-dnd`: Drag-and-drop incident board
- `date-fns`: Date formatting and manipulation
- **No state management library**: Uses React hooks (`useState`, `useEffect`, `useContext`)

**Build & Deployment:**
- Multi-stage Dockerfile (Node build → Nginx serve)
- Nginx serves static files and handles client-side routing
- Environment variables baked into bundle at build time

**Design Choice Rationale:**
- **React without Redux**: Application state is simple enough that Context API + hooks suffice
- **Vite over Create React App**: 10x faster HMR, better tree-shaking
- **Tailwind over CSS-in-JS**: Faster development, smaller bundle size, easier theming
- **Nginx over Node server**: Better performance for static files, built-in SSL support

### Backend Stack

**Core:**
- **Go 1.21**: High-performance, compiled language
- **Gin**: Fast HTTP web framework (8x faster than standard library)
- **GORM**: ORM for database interactions with auto-migrations

**Key Libraries:**
- `gorilla/websocket`: WebSocket implementation for real-time updates
- `google/uuid`: UUID generation for incident IDs
- Standard library for most operations (minimal dependencies)

**Design Choice Rationale:**
- **Go over Node.js/Python**: 10-50x better performance, native concurrency, smaller memory footprint
- **Gin over Echo/Fiber**: Mature ecosystem, excellent documentation, good middleware support
- **GORM over raw SQL**: Type-safe queries, automatic migrations, cleaner code
- **Native WebSocket over Socket.io**: Lower latency, no JavaScript dependency, simpler protocol

### AI Services Stack

**Core:**
- **Python 3.9+**: Industry standard for AI/ML
- **FastAPI**: Modern, fast Python web framework (AI Diagnosis, Incident Generator)
- **Flask**: Lightweight framework (Health Monitor)

**Key Libraries:**
- `openai`: SDK for Groq API calls
- `google-generativeai`: SDK for Gemini API calls
- `psycopg2`: PostgreSQL driver for health checks
- `redis`: Redis client for health checks
- `docker`: Docker SDK for container management
- `APScheduler`: Background job scheduling

**Design Choice Rationale:**
- **Python for AI**: Native support for AI libraries, fastest development time
- **FastAPI for AI services**: Async support, auto-generated OpenAPI docs, better for external API calls
- **Flask for Health Monitor**: Simpler, synchronous model fits the use case
- **Dual AI provider support**: Groq (faster, free) + Gemini (backup, better reasoning)

### Database Stack

**Primary Database:**
- **PostgreSQL 15**: ACID-compliant RDBMS
- **Schema**: 4 main tables (incidents, analyses, status_history, agent_executions)
- **Migrations**: Handled by GORM AutoMigrate

**Design Choice Rationale:**
- **PostgreSQL over MySQL**: Better JSON support, more advanced features, JSONB performance
- **PostgreSQL over MongoDB**: Structured data with relationships, ACID guarantees needed
- **GORM AutoMigrate over migration files**: Simpler for small team, schema in code

### Infrastructure Stack

**Deployment:**
- **GCP Compute Engine**: Virtual machine (e2-medium: 2 vCPU, 4GB RAM)
- **Docker Compose**: Container orchestration (simpler than Kubernetes for this scale)
- **Nginx**: Reverse proxy, SSL termination, load balancing
- **Let's Encrypt**: Free SSL certificates via Certbot
- **GCP Secret Manager**: Encrypted secret storage for API keys

**Networking:**
- **Custom Domain**: incidentsimulator.net (via Namecheap)
- **Cloud DNS**: DNS management
- **Firewall Rules**: Ports 80, 443, 3000, 8080, 8002

**Design Choice Rationale:**
- **VM over Cloud Run**: Mock systems need persistent state, WebSocket support
- **e2-medium over e2-small**: Better performance for multiple services (~$35-40/month)
- **Docker Compose over Kubernetes**: Simpler ops, lower resource overhead, easier debugging
- **Nginx over Cloud Load Balancer**: Lower cost, more control, easier SSL setup

---

## Service Breakdown

### 1. Frontend Service

**Purpose:** User interface for incident management

**Technology:**
- React 18 with TypeScript
- Vite for build tooling
- Nginx for serving static files

**Key Features:**
- Drag-and-drop incident board (4 columns: Triage → Investigating → Fixing → Resolved)
- Real-time WebSocket updates
- Modal dialogs for incident details
- AI diagnosis display
- SRE Agent workflow UI
- Mock system health cards
- Active user tracking (anonymous animals)
- Light/dark theme toggle

**File Structure:**
```
frontend/
├── src/
│   ├── components/         # React components
│   │   ├── IncidentColumn.tsx
│   │   ├── IncidentCard.tsx
│   │   ├── IncidentModal.tsx
│   │   ├── AgentWorkflow.tsx
│   │   ├── ActiveUsers.tsx
│   │   └── FilterBar.tsx
│   ├── services/
│   │   ├── api.ts          # API client
│   │   └── incidentMapper.ts
│   ├── contexts/
│   │   └── ThemeContext.tsx
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   ├── App.tsx             # Main app component
│   └── index.css           # Tailwind styles
├── Dockerfile              # Multi-stage build
└── nginx.conf              # Nginx configuration
```

**API Communication:**
- REST API for CRUD operations
- WebSocket for real-time updates
- Polling for health monitor status (every 5 seconds)

**Design Decisions:**
1. **Single Page Application (SPA)**: Better UX, no page refreshes
2. **No routing library**: Single page with modals, no need for React Router
3. **Component-based architecture**: Reusable components, easier maintenance
4. **Optimistic UI updates**: UI updates immediately, then syncs with backend
5. **Error boundaries**: Graceful error handling with fallback UI

**State Management:**
```typescript
// Main App state
const [incidents, setIncidents] = useState<Incident[]>([])
const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
const [activeUsers, setActiveUsers] = useState<User[]>([])
const [systemsHealth, setSystemsHealth] = useState<SystemHealth | null>(null)
const [theme, setTheme] = useState<'light' | 'dark'>('dark')
```

**WebSocket Integration:**
```typescript
// WebSocket connection
useEffect(() => {
  const ws = api.connectWebSocket((data) => {
    // Handle incident updates
    if (data.type === 'user_list_update') {
      setActiveUsers(data.users)
    } else {
      // Incident update
      setIncidents(prev => [...prev, mapIncident(data)])
    }
  })
  
  return () => ws.close()
}, [])
```

### 2. Backend Service

**Purpose:** REST API, WebSocket hub, business logic

**Technology:**
- Go 1.21
- Gin web framework
- GORM ORM
- Gorilla WebSocket

**Key Features:**
- RESTful API with 20+ endpoints
- WebSocket hub for real-time updates
- Database interactions with GORM
- AI service orchestration
- Agent execution management
- User presence tracking

**File Structure:**
```
backend/
├── internal/
│   ├── db/
│   │   └── db.go           # Database connection
│   ├── models/
│   │   └── models.go       # GORM models
│   ├── handlers/
│   │   ├── incident_handler.go
│   │   ├── analysis_handler.go
│   │   └── agent_handler.go
│   ├── services/
│   │   ├── incident_service.go
│   │   ├── agent_service.go
│   │   └── ai_client.go
│   ├── websocket/
│   │   └── hub.go          # WebSocket hub
│   ├── router/
│   │   └── router.go       # Route definitions
│   └── utils/
│       └── names.go        # Anonymous name generator
├── main.go                 # Entry point
└── Dockerfile
```

**Database Models:**
```go
type Incident struct {
    ID              string `gorm:"primaryKey"`
    Message         string
    Source          string
    Status          string // triage, investigating, fixing, resolved
    CreatedAt       time.Time
    UpdatedAt       time.Time
    StatusHistory   []StatusHistory
    Analysis        *IncidentAnalysis
    AgentExecutions []AgentExecution
}

type IncidentAnalysis struct {
    ID         string `gorm:"primaryKey"`
    IncidentID string
    Severity   string
    Diagnosis  string
    Solution   string
    Confidence float64
}

type AgentExecution struct {
    ID          string `gorm:"primaryKey"`
    IncidentID  string
    Status      string // awaiting_approval, executing, completed, failed
    Analysis    string
    Actions     string // JSON array
    Reasoning   string
}
```

**API Endpoints:**
```go
// Incidents
GET    /api/v1/incidents           // List all incidents
POST   /api/v1/incidents           // Create incident
GET    /api/v1/incidents/:id       // Get incident details
PATCH  /api/v1/incidents/:id/status // Update status
PATCH  /api/v1/incidents/:id/notes  // Update notes
DELETE /api/v1/incidents/:id       // Delete incident
POST   /api/v1/incidents/reset     // Reset all data

// Analysis
POST   /api/v1/incidents/:id/analyze // Trigger AI analysis

// Agent
POST   /api/v1/agent/analyze/:id    // Start agent analysis
GET    /api/v1/agent/executions/:id // Get execution status
POST   /api/v1/agent/approve/:id    // Approve agent actions
POST   /api/v1/agent/reject/:id     // Reject agent actions

// Generator
POST   /api/v1/generate-incident    // Generate random incident
GET    /api/v1/generator/status     // Get generator status
POST   /api/v1/generator/start      // Start auto-generation
POST   /api/v1/generator/stop       // Stop auto-generation

// WebSocket
GET    /api/v1/ws                   // WebSocket connection
```

**WebSocket Hub Design:**
```go
type Hub struct {
    clients    map[*websocket.Conn]bool
    users      map[*websocket.Conn]*User
    Broadcast  chan interface{}
    Register   chan *websocket.Conn
    Unregister chan *websocket.Conn
}

// Broadcasts to all connected clients
func (h *Hub) Run() {
    for {
        select {
        case client := <-h.Register:
            h.clients[client] = true
        case client := <-h.Unregister:
            delete(h.clients, client)
            h.RemoveUser(client)
        case message := <-h.Broadcast:
            // Send to all clients
            for client := range h.clients {
                client.WriteMessage(websocket.TextMessage, message)
            }
        }
    }
}
```

**CORS Configuration:**
```go
// Custom CORS middleware for PATCH support
r.Use(func(c *gin.Context) {
    c.Header("Access-Control-Allow-Origin", "*")
    c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    
    if c.Request.Method == "OPTIONS" {
        c.AbortWithStatus(http.StatusOK)
        return
    }
    c.Next()
})
```

**Design Decisions:**
1. **RESTful API design**: Standard HTTP methods, predictable endpoints
2. **WebSocket for real-time**: Lower latency than polling, bi-directional
3. **GORM AutoMigrate**: Automatic schema updates, no manual migrations
4. **UUID for IDs**: Globally unique, no collision risk, better for distributed systems
5. **Middleware architecture**: Reusable CORS, logging, error handling

### 3. AI Diagnosis Service

**Purpose:** Analyze incidents using AI (Groq or Gemini)

**Technology:**
- Python 3.9+ with FastAPI
- OpenAI SDK (for Groq API)
- Google Generative AI SDK

**Key Features:**
- Dual AI provider support (Groq primary, Gemini fallback)
- Automatic failover between providers
- Structured prompt engineering
- JSON response parsing
- Confidence scoring

**File Structure:**
```
ai-diagnosis/
├── main.py              # FastAPI app
├── requirements.txt     # Dependencies
└── Dockerfile
```

**API Endpoints:**
```python
POST /api/v1/diagnose    # Analyze incident
GET  /api/v1/health      # Health check
```

**AI Prompt Structure:**
```python
prompt = f"""You are an expert SRE analyzing an incident.

Incident: {incident_message}
Source: {incident_source}

Provide:
1. Severity (P0/P1/P2/P3)
2. Root cause diagnosis
3. Recommended solution
4. Confidence level (0-100)

Format as JSON:
{{
  "severity": "P1",
  "diagnosis": "...",
  "solution": "...",
  "confidence": 85
}}
"""
```

**Provider Failover Logic:**
```python
async def diagnose_incident(incident):
    # Try Groq first (faster, free)
    if GROQ_API_KEY:
        try:
            return await call_groq(incident)
        except Exception as e:
            logger.warning(f"Groq failed: {e}")
    
    # Fallback to Gemini
    if GEMINI_API_KEY:
        try:
            return await call_gemini(incident)
        except Exception as e:
            logger.error(f"Gemini failed: {e}")
    
    raise Exception("No AI provider available")
```

**Design Decisions:**
1. **Dual provider support**: Redundancy, cost optimization (Groq free tier)
2. **FastAPI over Flask**: Async support for concurrent AI calls
3. **Structured prompts**: Consistent JSON responses, easier parsing
4. **Confidence scoring**: User transparency, helps prioritize incidents
5. **Timeout handling**: 30s timeout to prevent hanging requests

### 4. Incident Generator Service

**Purpose:** Auto-generate realistic incidents for testing

**Technology:**
- Python 3.9+ with FastAPI
- OpenAI SDK (Groq/Gemini)
- APScheduler for background jobs

**Key Features:**
- On-demand incident generation
- Auto-generation mode (every 2-5 minutes)
- Realistic scenario templates
- Variety of systems (Redis, PostgreSQL, Disk, Network, Auth, etc.)

**Incident Templates:**
```python
INCIDENT_TEMPLATES = [
    # Redis issues
    {"source": "redis-test", "scenario": "High memory usage"},
    {"source": "redis-test", "scenario": "Connection pool exhausted"},
    {"source": "redis-test", "scenario": "Slow query performance"},
    
    # PostgreSQL issues
    {"source": "postgres-test", "scenario": "Connection limit reached"},
    {"source": "postgres-test", "scenario": "Table bloat detected"},
    {"source": "postgres-test", "scenario": "Deadlock detected"},
    
    # Disk issues
    {"source": "disk-monitor", "scenario": "Disk space critically low"},
    
    # Application issues
    {"source": "api-gateway", "scenario": "High latency"},
    {"source": "auth-service", "scenario": "Login failures"},
    {"source": "payment-service", "scenario": "Transaction timeout"},
]
```

**Generation Flow:**
```python
def generate_incident():
    # 1. Select random template
    template = random.choice(INCIDENT_TEMPLATES)
    
    # 2. Generate detailed message with AI
    prompt = f"Generate a realistic incident report for: {template['scenario']}"
    message = call_ai_api(prompt)
    
    # 3. Send to backend
    requests.post("http://backend:8080/api/v1/incidents", json={
        "message": message,
        "source": template["source"],
        "status": "triage"
    })
```

**Design Decisions:**
1. **Template-based generation**: Ensures variety, easier to add new scenarios
2. **AI-generated messages**: More realistic, varied language
3. **Configurable intervals**: 2-5 minute randomization prevents patterns
4. **Auto-start/stop**: User control over generation rate

### 5. Health Monitor Service

**Purpose:** Monitor mock systems and create incidents on failure

**Technology:**
- Python 3.9+ with Flask
- APScheduler for periodic checks
- Redis client, psycopg2 for health checks
- Docker SDK for container management

**Key Features:**
- Real-time health monitoring (every 5 seconds)
- Automatic incident creation on threshold breach
- Failure injection endpoints
- Health percentage calculation
- System recovery tracking

**Health Check Logic:**
```python
# Redis Health (memory-based)
health = 100 - memory_percent
if health < 50: create_incident()

# PostgreSQL Health (connection-based)
idle_ratio = (idle_connections / total_connections) * 100
health = 100 - idle_ratio
if health < 50: create_incident()

# PostgreSQL Bloat Health
dead_ratio = (dead_tuples / live_tuples) * 100
health = 100 / (1 + dead_ratio / 100)
if health < 50: create_incident()

# Disk Health
used_percent = (used_bytes / total_bytes) * 100
health = 100 - used_percent
if health < 50: create_incident()
```

**Failure Injection Endpoints:**
```python
# Redis failures
POST /trigger/redis-memory    # Fill Redis memory
POST /clear/redis             # Clear Redis data

# PostgreSQL failures
POST /trigger/postgres-connections  # Exhaust connections
POST /trigger/postgres-bloat        # Create dead tuples
POST /clear/postgres                # Kill connections
POST /clear/postgres-bloat          # Run VACUUM

# Disk failures
POST /trigger/disk-full       # Fill disk with dummy files
POST /clear/disk              # Remove dummy files
```

**Incident Prevention Logic:**
```python
# Prevent duplicate incidents
reported_incidents = set()

def check_health():
    health = calculate_health()
    
    if health < THRESHOLD:
        if system_name not in reported_incidents:
            create_incident()
            reported_incidents.add(system_name)
    else:
        # System recovered
        if system_name in reported_incidents:
            reported_incidents.remove(system_name)
```

**Design Decisions:**
1. **5-second polling**: Balance between responsiveness and CPU usage
2. **Threshold-based alerts**: 50% health triggers incidents
3. **Duplicate prevention**: Avoids incident spam
4. **Automatic recovery tracking**: Allows new incidents after fix
5. **Inverse health calculation**: 100% = healthy, 0% = critical

---

## Data Flow & Communication

### Incident Creation Flow

```
User → Frontend → Backend → PostgreSQL
                    ↓
                WebSocket Hub → All Clients
```

1. User clicks "Generate Incident" or triggers failure
2. Frontend sends POST request to backend
3. Backend creates incident in PostgreSQL
4. Backend broadcasts update via WebSocket
5. All connected clients receive update in real-time

### AI Diagnosis Flow

```
User → Frontend → Backend → AI Diagnosis Service → Groq/Gemini API
                    ↓                    ↓
              PostgreSQL ← Analysis Result
                    ↓
              WebSocket Hub → Frontend (updated incident)
```

1. User clicks "Analyze" on incident
2. Backend sends incident to AI Diagnosis service
3. AI service calls Groq API (or Gemini if Groq fails)
4. AI returns diagnosis JSON
5. Backend saves analysis to database
6. Backend broadcasts updated incident via WebSocket

### Failure Injection Flow

```
User → Frontend → Health Monitor → Mock System (Redis/PostgreSQL/Disk)
                         ↓
                   Health Check Loop
                         ↓
                   Create Incident → Backend → PostgreSQL
                                        ↓
                                   WebSocket Hub → All Clients
```

1. User selects failure type from dropdown
2. Frontend calls Health Monitor trigger endpoint
3. Health Monitor manipulates mock system (fill memory, create connections, etc.)
4. Health check loop detects degradation
5. Health Monitor creates incident via backend API
6. Incident appears on frontend via WebSocket

### Agent Remediation Flow

```
User → Frontend → Backend → AI Diagnosis → LLM Analysis
                    ↓
           Agent Execution Record
                    ↓
      User Approval/Rejection
                    ↓
           Execute Commands → Mock System
                    ↓
           Verify Success → Update Status
                    ↓
           WebSocket → Frontend
```

1. User requests agent analysis
2. Backend calls AI service with incident details
3. AI returns recommended actions + reasoning
4. Backend creates execution record (status: awaiting_approval)
5. User reviews and approves/rejects
6. If approved, backend executes commands
7. Backend polls for success verification
8. Status updates broadcast via WebSocket

---

## Database Architecture

### Schema Design

**incidents table:**
```sql
CREATE TABLE incidents (
    id VARCHAR(36) PRIMARY KEY,
    message TEXT NOT NULL,
    source VARCHAR(100),
    status VARCHAR(20),  -- triage, investigating, fixing, resolved
    team VARCHAR(100),
    generated_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    -- Agent fields
    incident_type VARCHAR(20),  -- real_system, synthetic, training
    actionable BOOLEAN,
    affected_systems JSONB,
    remediation_mode VARCHAR(20),  -- automated, manual, advisory
    metadata JSONB
);
```

**incident_analyses table:**
```sql
CREATE TABLE incident_analyses (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) REFERENCES incidents(id) ON DELETE CASCADE,
    severity VARCHAR(10),
    diagnosis TEXT,
    diagnosis_provider VARCHAR(20),
    solution TEXT,
    solution_provider VARCHAR(20),
    confidence FLOAT,
    created_at TIMESTAMP
);
```

**incident_status_history table:**
```sql
CREATE TABLE incident_status_history (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) REFERENCES incidents(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    changed_at TIMESTAMP
);
```

**agent_executions table:**
```sql
CREATE TABLE agent_executions (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) REFERENCES incidents(id) ON DELETE CASCADE,
    status VARCHAR(20),  -- awaiting_approval, executing, completed, failed
    analysis TEXT,
    reasoning TEXT,
    recommended_actions JSONB,
    executed_actions JSONB,
    execution_output TEXT,
    risk_assessment TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Relationships

```
incidents (1) ──→ (1) incident_analyses
incidents (1) ──→ (N) incident_status_history
incidents (1) ──→ (N) agent_executions
```

### Migration Strategy

**GORM AutoMigrate:**
```go
func InitDB() {
    db.AutoMigrate(
        &models.Incident{},
        &models.IncidentAnalysis{},
        &models.StatusHistory{},
        &models.AgentExecution{},
    )
}
```

**Design Decisions:**
1. **UUID primary keys**: Better for distributed systems, no collision risk
2. **JSONB for flexible data**: affected_systems, metadata can vary
3. **Cascade deletes**: Maintain referential integrity
4. **Status history tracking**: Audit trail for compliance
5. **No soft deletes**: Keep it simple, hard delete is fine for this use case

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── LoginScreen.tsx
├── TopNav
│   ├── GuideModal
│   ├── ActiveUsers
│   └── ThemeToggle
├── FilterBar
├── IncidentBoard
│   ├── IncidentColumn (×4)
│   │   └── IncidentCard (×N)
│   │       ├── SeverityBadge
│   │       └── StatusBadge
│   └── IncidentModal
│       ├── Timeline
│       ├── Notes Section
│       ├── Diagnosis Section
│       └── AgentWorkflow
│           ├── Analysis
│           ├── Actions
│           ├── Reasoning
│           └── Approval Buttons
├── MockSystemCards
│   └── InfoTooltip
└── ResolvedIncidentsPanel
```

### State Management Strategy

**No Redux/Zustand**: Using React Context + hooks

**Global State (App.tsx):**
```typescript
// Core data
const [incidents, setIncidents] = useState<Incident[]>([])
const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([])

// UI state
const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
const [showGuideModal, setShowGuideModal] = useState(false)
const [isGenerating, setIsGenerating] = useState(false)

// Real-time features
const [activeUsers, setActiveUsers] = useState<User[]>([])
const [systemsHealth, setSystemsHealth] = useState<SystemHealth | null>(null)
```

**Theme Context:**
```typescript
const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {}
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => 
    localStorage.getItem('theme') || 'dark'
  )
  
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return next
    })
  }
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### Key Features Implementation

**Drag-and-Drop (react-beautiful-dnd):**
```typescript
<DragDropContext onDragEnd={handleDragEnd}>
  {columns.map(column => (
    <Droppable droppableId={column.id} key={column.id}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {column.incidents.map((incident, index) => (
            <Draggable draggableId={incident.id} index={index}>
              {(provided) => (
                <IncidentCard
                  incident={incident}
                  dragHandleProps={provided.dragHandleProps}
                  draggableProps={provided.draggableProps}
                  innerRef={provided.innerRef}
                />
              )}
            </Draggable>
          ))}
        </div>
      )}
    </Droppable>
  ))}
</DragDropContext>
```

**Real-Time Updates (WebSocket):**
```typescript
useEffect(() => {
  const ws = api.connectWebSocket((data) => {
    if (data.type === 'user_list_update') {
      setActiveUsers(data.users)
    } else {
      // New incident
      setIncidents(prev => {
        const exists = prev.find(i => i.id === data.id)
        if (exists) {
          return prev.map(i => i.id === data.id ? data : i)
        }
        return [...prev, data]
      })
    }
  })
  
  return () => ws.close()
}, [])
```

**Health Monitor Polling:**
```typescript
useEffect(() => {
  const fetchHealth = async () => {
    try {
      const health = await api.getHealthMonitorStatus()
      setSystemsHealth(health)
    } catch (err) {
      console.error('Failed to fetch health')
    }
  }
  
  fetchHealth()
  const interval = setInterval(fetchHealth, 5000)
  return () => clearInterval(interval)
}, [])
```

**Design Decisions:**
1. **Component composition**: Small, reusable components
2. **Controlled components**: React controls all form inputs
3. **Optimistic updates**: Update UI immediately, sync later
4. **Error boundaries**: Catch and display errors gracefully
5. **Accessibility**: ARIA labels, keyboard navigation

---

## Deployment Architecture

### GCP Infrastructure

**Compute Engine VM:**
- **Type**: e2-medium (2 vCPU, 4GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **Region**: us-east1-b
- **Disk**: 20GB SSD persistent disk
- **Network**: Default VPC with custom firewall rules

**Why e2-medium?**
- e2-micro (1GB RAM): Too small, OOM errors
- e2-small (2GB RAM): Marginal, slow during builds
- e2-medium (4GB RAM): Stable, handles all 8 containers + builds
- Cost: ~$35-40/month (vs $5-10 for micro/small)

**Firewall Rules:**
```bash
# HTTP (redirects to HTTPS)
allow-http: tcp:80

# HTTPS (main access)
allow-https: tcp:443

# Direct service access (debugging)
allow-http-3000: tcp:3000   # Frontend
allow-http-8080: tcp:8080   # Backend
allow-http-8002: tcp:8002   # Health Monitor
```

### Docker Compose Configuration

**docker-compose.yml structure:**
```yaml
services:
  # Production services
  frontend:
    build:
      context: ./frontend
      args:
        - VITE_API_URL=${VITE_API_URL}
        - VITE_APP_PASSWORD=${VITE_APP_PASSWORD}
    ports:
      - "3000:80"
    depends_on:
      - backend
  
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - GROQ_API_KEY=${GROQ_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - postgres
  
  # AI services
  ai-diagnosis:
    build: ./ai-diagnosis
    ports:
      - "8000:8000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
  
  # Mock systems
  redis-test:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  postgres-test:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=testpass
    ports:
      - "5433:5432"
  
  # Main database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=incidentdb
      - POSTGRES_USER=incidentuser
      - POSTGRES_PASSWORD=incidentpass
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres-data:  # Persistent storage
```

### Nginx Configuration

**Purpose:** Reverse proxy, SSL termination, routing

**Configuration:**
```nginx
server {
    listen 80;
    server_name incidentsimulator.net www.incidentsimulator.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name incidentsimulator.net www.incidentsimulator.net;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/incidentsimulator.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/incidentsimulator.net/privkey.pem;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health Monitor
    location /status {
        proxy_pass http://localhost:8002/status;
    }
    
    location /trigger/ {
        proxy_pass http://localhost:8002/trigger/;
    }
    
    location /clear/ {
        proxy_pass http://localhost:8002/clear/;
    }

    # Frontend (catch-all, must be last)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

**SSL Setup:**
```bash
# Certbot (Let's Encrypt)
sudo certbot --nginx \
  -d incidentsimulator.net \
  -d www.incidentsimulator.net \
  --email tri_pham@outlook.com \
  --agree-tos \
  --redirect
```

**Auto-renewal:**
- Certbot creates systemd timer
- Runs twice daily: `certbot renew --dry-run`
- Certificates renew 30 days before expiration

### Secret Management

**GCP Secret Manager:**
```bash
# Store secrets
echo -n "$GROQ_API_KEY" | gcloud secrets create groq-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Fetch secrets (on VM startup)
GROQ_KEY=$(gcloud secrets versions access latest \
  --secret=groq-api-key)
echo "GROQ_API_KEY=$GROQ_KEY" >> .env
```

**Why Secret Manager?**
- ✅ Encrypted at rest
- ✅ Audit logging
- ✅ IAM access control
- ✅ Versioning
- ✅ No secrets in git or VM disk

### Deployment Scripts

**deploy-vm-standalone.sh:**
1. Enable GCP APIs (Compute, Secret Manager)
2. Store secrets from local `.env`
3. Create VM with startup script
4. Configure firewall rules
5. SSH into VM and setup app
6. Pull code from GitHub
7. Create `.env` from Secret Manager
8. Start Docker Compose
9. Setup systemd service for auto-restart

**update-vm-standalone.sh:**
- Option 1: Git pull (fastest, requires GitHub setup)
- Option 2: rsync upload (works without GitHub)
- Rebuilds only changed containers
- Zero-downtime updates

**Design Decisions:**
1. **Single VM vs Kubernetes**: Simpler ops, lower cost, easier debugging
2. **Docker Compose vs manual**: Reproducible, easier rollback
3. **Nginx vs Application routing**: Better performance, SSL offloading
4. **Systemd service**: Auto-restart on reboot, process management
5. **Secret Manager vs VM metadata**: Better security, audit trail

---

## Networking & DNS Configuration

### Domain Setup

**Domain:** incidentsimulator.net (via Namecheap)

**DNS Configuration (Namecheap → Google Cloud DNS):**
```
1. Create Cloud DNS zone: incidentsimulator.net
2. Get Google nameservers:
   - ns-cloud-a1.googledomains.com
   - ns-cloud-a2.googledomains.com
   - ns-cloud-a3.googledomains.com
   - ns-cloud-a4.googledomains.com
3. Update Namecheap nameservers
4. Add DNS records in Cloud DNS:
   - A record: incidentsimulator.net → 35.231.199.112
   - A record: www.incidentsimulator.net → 35.231.199.112
```

**Propagation Time:** 30-60 minutes (sometimes faster)

### URL Structure

**Production URLs:**
```
https://incidentsimulator.net              → Frontend (Nginx → :3000)
https://incidentsimulator.net/api/v1/*     → Backend API (Nginx → :8080)
https://incidentsimulator.net/status       → Health Monitor (Nginx → :8002)
https://incidentsimulator.net/trigger/*    → Failure injection (Nginx → :8002)
https://incidentsimulator.net/clear/*      → Clear failures (Nginx → :8002)

wss://incidentsimulator.net/api/v1/ws      → WebSocket
```

**Local Development URLs:**
```
http://localhost:3000                       → Frontend
http://localhost:8080/api/v1/*             → Backend API
http://localhost:8002/status               → Health Monitor
```

### HTTPS Implementation

**SSL/TLS Stack:**
- Let's Encrypt (free certificates)
- Certbot (automatic certificate management)
- Nginx (SSL termination)

**Certificate Details:**
- Valid for 90 days
- Auto-renewal via systemd timer
- RSA 2048-bit key
- TLS 1.2 and 1.3 support

**Security Headers:**
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
```

### Frontend Environment Variable Handling

**Challenge:** Frontend needs to know backend URL at build time

**Solution 1 - Local Development:**
```bash
# .env (not in git)
VITE_API_URL=http://localhost:8080/api/v1
VITE_APP_PASSWORD=changeme
```

**Solution 2 - Production:**
```bash
# .env on VM (created from Secret Manager + VM metadata)
VITE_API_URL=https://incidentsimulator.net/api/v1
VITE_APP_PASSWORD=incident.io
```

**Build Process:**
```typescript
// frontend/src/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Health monitor URL derived from API URL
const getHealthMonitorUrl = () => {
  const apiUrl = new URL(API_BASE_URL);
  // If HTTPS or production domain, use root path (Nginx proxies)
  if (apiUrl.protocol === 'https:' || apiUrl.hostname !== 'localhost') {
    return `${apiUrl.protocol}//${apiUrl.hostname}`;
  }
  // Local development: use port 8002 directly
  return `${apiUrl.protocol}//${apiUrl.hostname}:8002`;
};
```

**Design Decisions:**
1. **Build-time configuration**: Frontend is static files, can't change at runtime
2. **Automatic URL derivation**: Reduces configuration, fewer errors
3. **Nginx proxying**: Cleaner URLs, no CORS issues
4. **Environment-aware logic**: Same code works locally and in production

---

## Design Decisions

### 1. Microservices vs Monolith

**Chosen:** Microservices

**Rationale:**
- ✅ Language flexibility (Go for performance, Python for AI)
- ✅ Independent scaling (though not utilized yet)
- ✅ Fault isolation (AI service crash doesn't affect main app)
- ✅ Team specialization (different devs can own different services)
- ❌ More complex deployment (mitigated with Docker Compose)
- ❌ Network latency between services (acceptable for this use case)

### 2. PostgreSQL vs MongoDB

**Chosen:** PostgreSQL

**Rationale:**
- ✅ Structured data with clear relationships
- ✅ ACID guarantees needed for incident tracking
- ✅ Better JSON support (JSONB) than MySQL
- ✅ Mature ecosystem, better tooling
- ❌ Less flexible schema (acceptable, schema is stable)

### 3. WebSocket vs Server-Sent Events vs Polling

**Chosen:** WebSocket

**Rationale:**
- ✅ Bi-directional communication (future: user actions broadcast)
- ✅ Lower latency than polling
- ✅ More efficient than polling (no repeated HTTP overhead)
- ✅ Native browser support
- ❌ More complex than SSE (worth it for real-time UX)

### 4. React vs Vue vs Svelte

**Chosen:** React

**Rationale:**
- ✅ Largest ecosystem, most libraries
- ✅ Industry standard, easier hiring
- ✅ Best TypeScript support
- ✅ react-beautiful-dnd for drag-and-drop
- ❌ Larger bundle size (mitigated with code splitting)

### 5. Go vs Node.js vs Python for Backend

**Chosen:** Go

**Rationale:**
- ✅ 10-50x better performance than Node.js
- ✅ Native concurrency (goroutines)
- ✅ Compiled binary, easier deployment
- ✅ Better memory efficiency
- ✅ Strong typing with excellent tooling
- ❌ Steeper learning curve (acceptable)

### 6. Docker Compose vs Kubernetes

**Chosen:** Docker Compose

**Rationale:**
- ✅ Simpler to operate and debug
- ✅ Lower resource overhead
- ✅ Faster iteration (no cluster management)
- ✅ Sufficient for single-VM deployment
- ❌ No auto-scaling (not needed yet)
- ❌ No multi-node support (not needed)

### 7. VM vs Cloud Run vs Kubernetes

**Chosen:** VM (Compute Engine)

**Rationale:**
- ✅ Mock systems need persistent state
- ✅ WebSocket support (Cloud Run limitations)
- ✅ Full control over environment
- ✅ Simpler networking (no service mesh)
- ✅ Cost-effective for 24/7 workload
- ❌ Manual scaling (acceptable)
- ❌ No automatic failover (mitigated with systemd)

**Why not Cloud Run:**
- ❌ Stateless containers (incompatible with mock systems)
- ❌ Cold starts (bad for WebSocket UX)
- ❌ More expensive for 24/7 workload
- ❌ Complex networking for inter-service communication

### 8. Groq vs OpenAI vs Gemini

**Chosen:** Groq (primary) + Gemini (fallback)

**Rationale:**
- ✅ Groq: Faster inference (70+ tokens/sec)
- ✅ Groq: Free tier sufficient for development
- ✅ Gemini: Better reasoning for complex incidents
- ✅ Dual provider: Redundancy and failover
- ❌ OpenAI: More expensive, no free tier

### 9. GORM AutoMigrate vs Manual Migrations

**Chosen:** GORM AutoMigrate

**Rationale:**
- ✅ Schema defined in code (single source of truth)
- ✅ Automatic migrations on startup
- ✅ Faster development iteration
- ✅ Less boilerplate
- ❌ Less control over migration timing (acceptable for small team)
- ❌ Harder to rollback (acceptable, can rebuild)

### 10. Nginx vs Application-Level Routing

**Chosen:** Nginx

**Rationale:**
- ✅ Better performance (C vs Go/Node)
- ✅ SSL/TLS termination offloaded
- ✅ Static file serving optimized
- ✅ Built-in load balancing
- ✅ Industry-standard reverse proxy
- ❌ Additional configuration (worth it for performance)

### 11. Let's Encrypt vs Paid SSL

**Chosen:** Let's Encrypt

**Rationale:**
- ✅ Free
- ✅ Automatic renewal
- ✅ Industry-standard encryption
- ✅ 90-day validity (forces good practices)
- ❌ No warranty (acceptable for non-commercial)

### 12. Tailwind vs CSS-in-JS vs CSS Modules

**Chosen:** Tailwind CSS

**Rationale:**
- ✅ Faster development (utility classes)
- ✅ Smaller bundle size (unused classes purged)
- ✅ Consistent design system
- ✅ No runtime overhead
- ✅ Better performance than CSS-in-JS
- ❌ Learning curve (acceptable, widely adopted)

### 13. JWT vs Session vs Simple Password

**Chosen:** Simple Password (localStorage)

**Rationale:**
- ✅ Simplest possible auth (demo app)
- ✅ No user accounts needed
- ✅ No backend session management
- ✅ Fast to implement
- ❌ Not secure for production (acceptable for demo)
- ❌ No user-specific permissions (not needed)

**Note:** This is intentionally simple for a simulator. Production would use OAuth/JWT.

### 14. Real-Time Updates: Push vs Pull

**Chosen:** Hybrid (WebSocket push + Health Monitor polling)

**Rationale:**
- ✅ WebSocket for incidents: Instant updates, low latency
- ✅ Polling for health: Simpler, more reliable (HTTP vs WS)
- ✅ Health data changes frequently (5s polling acceptable)
- ✅ Easier error handling for health checks

### 15. Monorepo vs Polyrepo

**Chosen:** Monorepo

**Rationale:**
- ✅ Easier to coordinate changes across services
- ✅ Shared types and utilities
- ✅ Single git history
- ✅ Simpler CI/CD
- ✅ Better for small team
- ❌ Larger repo size (acceptable)

---

## Performance Considerations

### Frontend Optimizations

**1. Code Splitting:**
```typescript
// Lazy load heavy components
const IncidentModal = lazy(() => import('./components/IncidentModal'))
```

**2. Memoization:**
```typescript
// Prevent unnecessary re-renders
const MemoizedIncidentCard = memo(IncidentCard)

// Memoize expensive calculations
const sortedIncidents = useMemo(() => 
  incidents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  [incidents]
)
```

**3. Debouncing:**
```typescript
// Debounce health monitor polling
useEffect(() => {
  const timer = setTimeout(() => fetchHealth(), 5000)
  return () => clearTimeout(timer)
}, [systemsHealth])
```

**4. Bundle Size:**
- Vite tree-shaking: Removes unused code
- Tailwind purging: Removes unused CSS
- Gzip compression: Nginx compresses responses
- **Result:** ~300KB initial load (gzipped)

### Backend Optimizations

**1. Database Connection Pooling:**
```go
db.DB.SetMaxOpenConns(25)
db.DB.SetMaxIdleConns(5)
db.DB.SetConnMaxLifetime(time.Hour)
```

**2. Eager Loading:**
```go
// Load relationships in single query
db.Preload("Analysis").Preload("StatusHistory").Find(&incidents)
```

**3. Index Usage:**
```go
// Composite index for common queries
type Incident struct {
    Status    string `gorm:"index:idx_status_created"`
    CreatedAt time.Time `gorm:"index:idx_status_created"`
}
```

**4. Goroutine Concurrency:**
```go
// Handle WebSocket broadcasts concurrently
go WSHub.Run()

// Non-blocking AI calls
go func() {
    analysis := callAIDiagnosis(incident)
    WSHub.Broadcast <- analysis
}()
```

### Infrastructure Optimizations

**1. Docker Layer Caching:**
```dockerfile
# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm install

# Copy source code last (changes frequently)
COPY . .
RUN npm run build
```

**2. Multi-Stage Builds:**
```dockerfile
# Build stage
FROM node:18 AS build
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

**3. Nginx Caching:**
```nginx
# Cache static files
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**4. HTTP/2:**
```nginx
listen 443 ssl http2;  # Enable HTTP/2 for multiplexing
```

### Monitoring & Profiling

**Planned (not yet implemented):**
- Prometheus metrics export
- Grafana dashboards
- Application tracing (OpenTelemetry)
- Error tracking (Sentry)

---

## Future Improvements

### Short Term (Next Sprint)

1. **User Authentication**
   - JWT-based auth
   - User accounts with roles
   - Per-user incident assignments

2. **Enhanced AI Agent**
   - Multi-step execution plans
   - Rollback capability
   - Success verification improvements

3. **Incident Templates**
   - Pre-defined incident types
   - Custom fields per template
   - SLA tracking

4. **Email Notifications**
   - Incident creation alerts
   - Status change notifications
   - SLA breach warnings

### Medium Term (Next Quarter)

1. **Metrics & Analytics**
   - Incident dashboard
   - MTTR (Mean Time To Resolution)
   - Incident frequency trends
   - Team performance metrics

2. **Integration Support**
   - PagerDuty integration
   - Slack notifications
   - Webhook support
   - Jira sync

3. **Advanced Failure Scenarios**
   - Network latency injection
   - Service mesh failures
   - Kubernetes pod crashes
   - Multi-service cascading failures

4. **Mobile App**
   - React Native app
   - Push notifications
   - On-call management

### Long Term (Next Year)

1. **Multi-Tenancy**
   - Organization support
   - Team hierarchies
   - Custom branding

2. **Machine Learning**
   - Incident prediction
   - Auto-categorization
   - Similar incident detection

3. **Runbook Automation**
   - Visual workflow builder
   - Automated remediation scripts
   - Approval workflows

4. **Enterprise Features**
   - SSO (SAML, OAuth)
   - Audit logging
   - Compliance reports
   - Role-based access control (RBAC)

---

## Appendix

### Environment Variables Reference

**Backend:**
```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=incidentuser
DB_PASSWORD=incidentpass
DB_NAME=incidentdb

# AI Providers
GROQ_API_KEY=gsk_xxx
GEMINI_API_KEY=xxx

# Service URLs
AI_DIAGNOSIS_URL=http://ai-diagnosis:8000
INCIDENT_GENERATOR_URL=http://incident-generator:8001
HEALTH_MONITOR_URL=http://health-monitor:8002
```

**Frontend:**
```bash
# Build-time variables (baked into bundle)
VITE_API_URL=https://incidentsimulator.net/api/v1
VITE_APP_PASSWORD=incident.io
```

**AI Services:**
```bash
GROQ_API_KEY=gsk_xxx
GEMINI_API_KEY=xxx
PORT=8000  # For Cloud Run compatibility
```

### Useful Commands

**Local Development:**
```bash
# Start all services
./scripts/local-start.sh

# View logs
./scripts/local-logs.sh

# Restart specific service
docker compose restart backend

# Rebuild after code changes
docker compose up -d --build frontend
```

**VM Management:**
```bash
# Deploy initial setup
./scripts/deploy-vm-standalone.sh

# Update code on VM
./scripts/update-vm-standalone.sh

# Check VM status
./scripts/check-vm-status.sh

# View VM logs
gcloud compute ssh incident-simulator --zone=us-east1-b
sudo docker compose logs -f backend
```

**Database:**
```bash
# Connect to main database
docker compose exec postgres psql -U incidentuser incidentdb

# Reset all data
curl -X POST http://localhost:8080/api/v1/incidents/reset

# Backup database
docker compose exec postgres pg_dump -U incidentuser incidentdb > backup.sql
```

### API Testing Examples

**Create Incident:**
```bash
curl -X POST https://incidentsimulator.net/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "message": "API gateway timeout",
    "source": "api-gateway",
    "status": "triage"
  }'
```

**Trigger AI Analysis:**
```bash
curl -X POST https://incidentsimulator.net/api/v1/incidents/{id}/analyze
```

**Inject Redis Failure:**
```bash
curl -X POST https://incidentsimulator.net/trigger/redis-memory
```

**Get Health Status:**
```bash
curl https://incidentsimulator.net/status
```

---

## Conclusion

The Incident Management Simulator is a production-ready, full-stack application showcasing modern microservices architecture, AI integration, and DevOps best practices. The system demonstrates:

- **Scalable Architecture**: Microservices with clear separation of concerns
- **Real-Time Features**: WebSocket-powered live updates
- **AI Integration**: Dual provider support with automatic failover
- **Production Deployment**: HTTPS, custom domain, automated certificate management
- **Developer Experience**: Simple local development, easy updates, comprehensive documentation

The design prioritizes **simplicity, performance, and maintainability** while providing a realistic simulation of incident management workflows used by companies like incident.io, PagerDuty, and Datadog.

**Total Development Time:** ~2 weeks (estimated)  
**Lines of Code:** ~15,000 (estimated)  
**Monthly Operating Cost:** ~$35-40 (GCP e2-medium VM)

---

**For more information:**
- GitHub: https://github.com/tri27pham/incident-management-simulator
- Live Demo: https://incidentsimulator.net
- Password: `incident.io`

*This document is current as of November 12, 2025.*

