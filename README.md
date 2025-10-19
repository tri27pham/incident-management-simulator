# incident-management-simulator
A full-stack incident management simulator that models how real teams handle, triage, and resolve system incidents — with AI-powered root cause analysis.

## Phase 0 — Infrastructure Setup

The initial phase established the project’s foundational architecture using Docker Compose.  
All core services were containerized and verified to run correctly in a shared network environment.

### Services
- **backend** — Go API service (port 8080)
- **frontend** — Node-based frontend served with Nginx (port 3000)
- **ai-diagnosis** — Python FastAPI service (port 8000)
- **incident-generator** — Go service for simulating incidents
- **postgres** — PostgreSQL database (port 5432)

### Achievements
- Created a **multi-service Docker Compose configuration** with shared networking
- Built and successfully ran all containers (`docker compose up -d --build`)
- Verified inter-service communication via Docker’s internal network
- Confirmed health endpoints:
  - `curl localhost:8080/health` → `OK`
  - `curl localhost:8000/health` → `{"status":"ok"}`
- Ensured all containers remain running and accessible

### Definition of Done
- [x] Dockerized architecture operational
- [x] Each service builds without errors
- [x] Containers stay active after startup
- [x] Health checks pass for backend and AI diagnosis services
- [x] Local setup matches production-style deployment structure
