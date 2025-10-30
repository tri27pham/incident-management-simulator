# Quick Start Guide
**Incident Management Simulator**

---

## Local Development

### 1. Prerequisites
```bash
# Required
- Docker & Docker Compose
- Git

# Optional (for development)
- Go 1.21+
- Node.js 18+
- Python 3.11+
```

### 2. Clone & Configure
```bash
git clone <repository-url>
cd incident-management-simulator

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 3. Start Services
```bash
# Start all services
./scripts/start-docker.sh

# Or use docker-compose directly
docker-compose up -d --build

# Check status
docker ps
```

### 4. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **AI Diagnosis**: http://localhost:8000
- **Health Monitor**: http://localhost:8002

**Default Password**: Set in `.env` file (`APP_PASSWORD`)

### 5. Stop Services
```bash
./scripts/stop-docker.sh

# Or
docker-compose down
```

---

## Testing Locally

### Quick Test
```bash
# Run verification script
./scripts/verify-deployment.sh
```

### Manual Testing
```bash
# Check system health
curl http://localhost:8002/status | jq

# Trigger Redis failure
curl -X POST http://localhost:8002/trigger/redis-memory

# Trigger PostgreSQL failure
curl -X POST http://localhost:8002/trigger/postgres-connections

# Trigger disk failure
curl -X POST http://localhost:8002/trigger/disk-full

# Clear all failures
curl -X POST http://localhost:8002/clear/redis
curl -X POST http://localhost:8002/clear/postgres
curl -X POST http://localhost:8002/clear/disk

# Reset database
curl -X POST http://localhost:8080/api/v1/reset
```

---

## GKE Deployment

### Quick Deploy
```bash
# 1. Set variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# 2. Create cluster
gcloud container clusters create-auto incident-simulator \
  --region=$REGION --project=$PROJECT_ID

# 3. Get credentials
gcloud container clusters get-credentials incident-simulator \
  --region=$REGION --project=$PROJECT_ID

# 4. Build and push images
export IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/incident-simulator"

docker build -t ${IMAGE_PREFIX}/frontend:latest ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest

docker build -t ${IMAGE_PREFIX}/backend:latest ./backend
docker push ${IMAGE_PREFIX}/backend:latest

docker build -t ${IMAGE_PREFIX}/ai-diagnosis:latest ./ai-diagnosis
docker push ${IMAGE_PREFIX}/ai-diagnosis:latest

docker build -t ${IMAGE_PREFIX}/health-monitor:latest ./health-monitor
docker push ${IMAGE_PREFIX}/health-monitor:latest

# 5. Create secrets
kubectl create secret generic app-secrets \
  --from-literal=app-password=YOUR_PASSWORD \
  --from-literal=groq-api-key=YOUR_GROQ_KEY \
  --from-literal=gemini-api-key=YOUR_GEMINI_KEY \
  --from-literal=db-password=YOUR_DB_PASSWORD

# 6. Deploy (use manifests from GKE_DEPLOYMENT_GUIDE.md)
kubectl apply -f kubernetes/

# 7. Get external IP
kubectl get service frontend -n incident-simulator
```

### Full Guide
See `GKE_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## Common Commands

### Docker
```bash
# View logs
docker logs backend -f
docker logs frontend -f
docker logs ai-diagnosis -f

# Restart service
docker-compose restart backend

# Rebuild single service
docker-compose up -d --build backend

# Clean up
docker-compose down -v  # Remove volumes too
```

### Kubernetes
```bash
# View pods
kubectl get pods -n incident-simulator

# View logs
kubectl logs -f deployment/backend -n incident-simulator

# Scale deployment
kubectl scale deployment backend --replicas=3 -n incident-simulator

# Restart deployment
kubectl rollout restart deployment/backend -n incident-simulator

# Execute command in pod
kubectl exec -it deployment/backend -n incident-simulator -- /bin/sh

# Port forward for testing
kubectl port-forward -n incident-simulator service/frontend 3000:80
```

---

## Environment Variables

### Required
```bash
# Authentication
APP_PASSWORD=your-secure-password

# AI Services
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### Optional (Auto-configured in Docker Compose)
```bash
DATABASE_URL=postgres://user:pass@postgres:5432/incidents
AI_DIAGNOSIS_URL=http://ai-diagnosis:8000
HEALTH_MONITOR_URL=http://health-monitor:8002
VITE_API_URL=http://localhost:8080/api/v1
VITE_WS_URL=ws://localhost:8080/ws
```

---

## Troubleshooting

### Services not starting
```bash
# Check logs
docker-compose logs

# Check specific service
docker logs backend

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

### Database connection issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection from backend
docker exec -it backend sh
nc -zv postgres 5432
```

### AI diagnosis not working
```bash
# Check API keys are set
docker exec -it ai-diagnosis env | grep API_KEY

# Check AI service logs
docker logs ai-diagnosis -f
```

### Frontend not loading
```bash
# Check frontend logs
docker logs frontend

# Check Nginx config
docker exec -it frontend cat /etc/nginx/conf.d/default.conf

# Rebuild frontend
docker-compose up -d --build frontend
```

### "Incident not created after failure"
- Health monitor polls every 5 seconds
- Incidents may take up to 15 seconds to appear
- Check health monitor logs: `docker logs health-monitor`

---

## Key Features

### In the UI:
1. **Generate Incident** - Create AI-generated synthetic incident
2. **Trigger Failure** - Inject failures into mock systems
3. **Create Incident** - Manually create incident with full details
4. **View Resolved** - See all resolved incidents
5. **Reset All** - Clear all incidents and restore systems
6. **Guide** - In-app documentation

### In Incident Cards:
1. **Get AI Diagnosis** - AI analyzes the incident
2. **Get AI Solution** - AI provides fix recommendations
3. **Start SRE Agent Remediation** - Automated fix (for agent-ready incidents)
4. **Update Status** - Change incident status
5. **Change Severity** - Adjust severity level
6. **Change Team** - Reassign to different team

### Mock Systems:
- **Redis**: Memory exhaustion → Agent can clear cache or restart
- **PostgreSQL Connections**: Idle connection exhaustion → Agent can kill connections
- **PostgreSQL Bloat**: Dead tuples accumulation → Agent can run VACUUM
- **Disk Space**: Disk full → Agent can cleanup logs

---

## Documentation

- **README.md** - Project overview
- **DEPLOYMENT_TEST_REPORT.md** - Full test results
- **GKE_DEPLOYMENT_GUIDE.md** - Complete deployment guide
- **PRE_DEPLOYMENT_SUMMARY.md** - Deployment readiness summary
- **QUICK_START.md** - This file

---

## Support

### Logs
- Backend: `docker logs backend -f`
- Frontend: `docker logs frontend -f`
- AI Diagnosis: `docker logs ai-diagnosis -f`
- Health Monitor: `docker logs health-monitor -f`

### Health Check
```bash
curl http://localhost:8002/status | jq
```

### Verification
```bash
./scripts/verify-deployment.sh
```

---

## Quick Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 8080 | http://localhost:8080 |
| AI Diagnosis | 8000 | http://localhost:8000 |
| Health Monitor | 8002 | http://localhost:8002 |
| PostgreSQL (Main) | 5432 | postgres://localhost:5432 |
| PostgreSQL (Test) | 5433 | postgres://localhost:5433 |
| Redis (Test) | 6380 | redis://localhost:6380 |

---

**Need more help?** Check the full documentation or review logs for specific error messages.

