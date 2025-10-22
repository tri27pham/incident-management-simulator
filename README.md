# Incident Management Simulator

A full-stack application that simulates incident management with AI-powered diagnosis and suggested fixes.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (running)
- Go 1.21+
- Node.js 18+
- Python 3.9+

### Start Everything
```bash
./start.sh
```

This will:
1. Check if Docker is running
2. **Kill any conflicting services on ports 8080, 5173, 8000**
3. Start PostgreSQL in Docker
4. Clean up stale database connections
5. Start the backend (Go)
6. Start AI diagnosis service (FastAPI)
7. Start the frontend (React)
8. Start the incident generator (optional)
9. Verify all services are healthy

**Note:** The script automatically handles port conflicts by killing old processes before starting new ones.

### Stop Everything
```bash
./stop.sh
```

This will:
1. Kill processes by PID files
2. **Kill any remaining processes on ports 8080, 5173, 8000** (catches orphaned processes)
3. Kill processes by name pattern (final fallback)
4. Stop PostgreSQL container
5. Clean up stale log files

**Note:** Uses a three-layer approach (PID → Port → Name) to ensure all services are stopped completely.

### Check Status
```bash
./status.sh
```

### View Logs
```bash
./logs.sh              # All logs
./logs.sh backend      # Backend only
./logs.sh frontend     # Frontend only
./logs.sh ai           # AI diagnosis only
./logs.sh generator    # Incident generator only
```

---

## 📊 Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | React UI for incident board |
| Backend API | http://localhost:8080 | Go API server |
| AI Diagnosis | http://localhost:8000 | FastAPI AI service |
| PostgreSQL | localhost:5432 | Database |

---

## 🗄️ Database Management

### Clear All Incidents
```bash
./clear-db.sh
```
Deletes all incidents but keeps schema intact.

### Reset Database (Nuclear)
```bash
./reset-db.sh
```
Completely destroys and recreates the database.

---

## 🔍 Troubleshooting

### Services Won't Start

The start script automatically handles most issues, but if you still have problems:

1. **Run stop.sh first:**
   ```bash
   ./stop.sh
   ```
   This uses a three-layer cleanup to ensure all old processes are killed.

2. **Check if Docker is running:**
   ```bash
   docker info
   ```
   If not, start Docker Desktop.

3. **Manually check for port conflicts:**
   ```bash
   lsof -ti:8080,5173,8000,5432
   ```
   The start script should handle this automatically, but you can verify.

4. **Check logs:**
   ```bash
   ./logs.sh
   ```

**Note:** The start script now includes pre-flight checks that automatically kill conflicting processes.

### AI Diagnosis Not Working

1. **Check environment variables:**
   ```bash
   cat .env | grep -E "GEMINI_API_KEY|AI_DIAGNOSIS_URL"
   ```

2. **Verify AI service is responding:**
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

3. **Check backend has AI URL:**
   ```bash
   ./status.sh
   ```

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

Create a `.env` file in the project root:

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=incident_user
POSTGRES_PASSWORD=incident_pass
POSTGRES_DB=incident_db

# AI Services
GEMINI_API_KEY=your-api-key-here
AI_DIAGNOSIS_URL=http://localhost:8000
```

---

## 🎯 Features

- ✅ Real-time incident board with drag-and-drop
- ✅ AI-powered diagnosis using Google Gemini
- ✅ Automated incident generation
- ✅ WebSocket live updates
- ✅ Severity-based filtering
- ✅ Team-based filtering
- ✅ Two-stage card expansion
- ✅ Full incident details modal

---

## 📦 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Go, Gin, GORM
- **AI Service:** Python, FastAPI, Google Gemini
- **Database:** PostgreSQL
- **Real-time:** WebSockets

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

1. Check `./status.sh` to see which services are running
2. Check logs with `./logs.sh`
3. Try stopping and restarting: `./stop.sh && ./start.sh`
4. For database issues: `./reset-db.sh` (⚠️ destroys all data)
