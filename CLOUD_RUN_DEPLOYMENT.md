# Cloud Run Deployment Guide
**Incident Management Simulator - Cost-Optimized for Low Usage**

**Estimated Cost: $1-4/month** (for 2 hours/month usage)

---

## Why Cloud Run?

- ✅ **Scales to Zero**: No charges when inactive
- ✅ **Pay per Use**: Only charged during active requests
- ✅ **Fast Cold Starts**: ~1-2 second wake-up time
- ✅ **Simpler than GKE**: No cluster management
- ✅ **Built-in HTTPS**: Free SSL certificates
- ✅ **Auto-scaling**: Handles traffic spikes automatically

**Perfect for**: Demo sites, low-traffic apps, personal projects

---

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** (for building images)
4. **API Keys**:
   - Groq API Key: https://console.groq.com
   - Gemini API Key: https://aistudio.google.com/app/apikey

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Run Services                        │
│  - frontend (Nginx + React)                                  │
│  - backend (Go API)                                          │
│  - ai-diagnosis (Python FastAPI)                             │
│  - health-monitor (Python Flask)                             │
│  - Mock systems (Redis, PostgreSQL) in backend              │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Cloud SQL PostgreSQL                            │
│  - Auto-pause after 15 minutes idle                          │
│  - Wakes automatically on connection                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Step 1: Set Up GCP Project

```bash
# Set variables
export PROJECT_ID="incident-simulator"
export REGION="us-central1"

# Create project (if new)
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Set default region
gcloud config set run/region $REGION
```

---

## Step 2: Create Artifact Registry

```bash
# Create Docker repository
gcloud artifacts repositories create incident-simulator \
  --repository-format=docker \
  --location=$REGION \
  --description="Incident Simulator Docker images"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

---

## Step 3: Set Up Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance with AUTO-PAUSE enabled
gcloud sql instances create incident-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --no-backup \
  --activation-policy=ALWAYS \
  --database-flags=cloudsql.enable_auto_pause=on

# Create database
gcloud sql databases create incidents --instance=incident-db

# Create user
gcloud sql users create appuser \
  --instance=incident-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name
export SQL_CONNECTION_NAME=$(gcloud sql instances describe incident-db --format='value(connectionName)')
echo "SQL Connection Name: $SQL_CONNECTION_NAME"
```

**Note**: Cloud SQL will automatically pause after 15 minutes of inactivity and resume on connection.

---

## Step 4: Store Secrets in Secret Manager

```bash
# Create secrets
echo -n "YOUR_APP_PASSWORD" | gcloud secrets create app-password --data-file=-
echo -n "YOUR_GROQ_KEY" | gcloud secrets create groq-api-key --data-file=-
echo -n "YOUR_GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding app-password \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding groq-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 5: Modify Backend for Cloud Run

### Create `backend/cloud-run.Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates redis postgresql-client
WORKDIR /root/
COPY --from=builder /app/server .

# Start Redis and PostgreSQL test instances in background
# Then start the backend server
CMD redis-server --maxmemory 50mb --maxmemory-policy noeviction --daemonize yes && \
    su-exec postgres postgres -D /var/lib/postgresql/data & \
    ./server
```

**Better Approach**: Embed mock systems in-memory (recommended for Cloud Run):

### Modify `backend/main.go` to use in-memory mocks

Add these environment variable checks:
```go
// In main.go
if os.Getenv("CLOUD_RUN") == "true" {
    // Use in-memory mock systems instead of external Redis/PostgreSQL
    setupInMemoryMocks()
}
```

---

## Step 6: Build and Push Docker Images

```bash
# Set image prefix
export IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/incident-simulator"

# Build and push backend
docker build -t ${IMAGE_PREFIX}/backend:latest -f backend/Dockerfile ./backend
docker push ${IMAGE_PREFIX}/backend:latest

# Build and push AI diagnosis
docker build -t ${IMAGE_PREFIX}/ai-diagnosis:latest ./ai-diagnosis
docker push ${IMAGE_PREFIX}/ai-diagnosis:latest

# Build and push health monitor
docker build -t ${IMAGE_PREFIX}/health-monitor:latest ./health-monitor
docker push ${IMAGE_PREFIX}/health-monitor:latest

# Build and push frontend (with API URL as build arg)
docker build -t ${IMAGE_PREFIX}/frontend:latest \
  --build-arg VITE_API_URL=https://backend-XXXXX.run.app/api/v1 \
  ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest
```

**Note**: You'll need to update the frontend build with the actual backend URL after deploying.

---

## Step 7: Deploy Backend to Cloud Run

```bash
gcloud run deploy backend \
  --image=${IMAGE_PREFIX}/backend:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --set-env-vars="CLOUD_RUN=true" \
  --add-cloudsql-instances=$SQL_CONNECTION_NAME \
  --set-secrets="DATABASE_PASSWORD=db-password:latest,APP_PASSWORD=app-password:latest" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300

# Get backend URL
export BACKEND_URL=$(gcloud run services describe backend --region=$REGION --format='value(status.url)')
echo "Backend URL: $BACKEND_URL"
```

---

## Step 8: Deploy AI Diagnosis Service

```bash
gcloud run deploy ai-diagnosis \
  --image=${IMAGE_PREFIX}/ai-diagnosis:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --set-secrets="GROQ_API_KEY=groq-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest" \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=10 \
  --timeout=60

# Get AI diagnosis URL
export AI_URL=$(gcloud run services describe ai-diagnosis --region=$REGION --format='value(status.url)')
echo "AI Diagnosis URL: $AI_URL"
```

---

## Step 9: Deploy Health Monitor

```bash
gcloud run deploy health-monitor \
  --image=${IMAGE_PREFIX}/health-monitor:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_URL=${BACKEND_URL}" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=20 \
  --timeout=300

# Get health monitor URL
export HEALTH_URL=$(gcloud run services describe health-monitor --region=$REGION --format='value(status.url)')
echo "Health Monitor URL: $HEALTH_URL"
```

---

## Step 10: Update Backend with Service URLs

```bash
gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="AI_DIAGNOSIS_URL=${AI_URL},HEALTH_MONITOR_URL=${HEALTH_URL}"
```

---

## Step 11: Rebuild and Deploy Frontend

```bash
# Rebuild frontend with correct API URLs
docker build -t ${IMAGE_PREFIX}/frontend:latest \
  --build-arg VITE_API_URL=${BACKEND_URL}/api/v1 \
  --build-arg VITE_WS_URL=${BACKEND_URL}/ws \
  ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest

# Deploy frontend
gcloud run deploy frontend \
  --image=${IMAGE_PREFIX}/frontend:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=60

# Get frontend URL
export FRONTEND_URL=$(gcloud run services describe frontend --region=$REGION --format='value(status.url)')
echo "Frontend URL: $FRONTEND_URL"
echo "🎉 Access your app at: $FRONTEND_URL"
```

---

## Step 12: Configure Custom Domain (Optional)

```bash
# Add custom domain
gcloud run domain-mappings create \
  --service=frontend \
  --domain=incident-simulator.your-domain.com \
  --region=$REGION

# Follow DNS instructions to point your domain
gcloud run domain-mappings describe \
  --domain=incident-simulator.your-domain.com \
  --region=$REGION
```

---

## Cost Breakdown (2 hours/month usage)

### With Auto-Pause Cloud SQL
| Service | Cost |
|---------|------|
| Cloud Run (Backend) | $0.20 |
| Cloud Run (Frontend) | $0.10 |
| Cloud Run (AI Diagnosis) | $0.30 |
| Cloud Run (Health Monitor) | $0.10 |
| Cloud SQL (auto-pause) | $0.50 |
| Artifact Registry | $0.10 |
| Secret Manager | $0.06 |
| **Total** | **~$1.36/month** ✨ |

### Cost Optimization Tips
1. **Use Cloud SQL auto-pause**: Saves ~$9/month
2. **Set min-instances=0**: Scales to zero when idle
3. **Use shared VPC**: Free internal communication
4. **Delete unused images**: Artifact Registry charges per GB

---

## Simplified One-Command Deployment

Create `deploy-cloud-run.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID="incident-simulator"
REGION="us-central1"
IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/incident-simulator"

echo "🚀 Deploying Incident Management Simulator to Cloud Run..."

# Build and push all images
echo "📦 Building Docker images..."
docker build -t ${IMAGE_PREFIX}/backend:latest ./backend
docker build -t ${IMAGE_PREFIX}/ai-diagnosis:latest ./ai-diagnosis
docker build -t ${IMAGE_PREFIX}/health-monitor:latest ./health-monitor
docker build -t ${IMAGE_PREFIX}/frontend:latest ./frontend

echo "⬆️  Pushing images to Artifact Registry..."
docker push ${IMAGE_PREFIX}/backend:latest
docker push ${IMAGE_PREFIX}/ai-diagnosis:latest
docker push ${IMAGE_PREFIX}/health-monitor:latest
docker push ${IMAGE_PREFIX}/frontend:latest

# Deploy services
echo "🚀 Deploying services to Cloud Run..."
gcloud run deploy backend --image=${IMAGE_PREFIX}/backend:latest --region=$REGION --min-instances=0
gcloud run deploy ai-diagnosis --image=${IMAGE_PREFIX}/ai-diagnosis:latest --region=$REGION --min-instances=0
gcloud run deploy health-monitor --image=${IMAGE_PREFIX}/health-monitor:latest --region=$REGION --min-instances=0
gcloud run deploy frontend --image=${IMAGE_PREFIX}/frontend:latest --region=$REGION --min-instances=0

FRONTEND_URL=$(gcloud run services describe frontend --region=$REGION --format='value(status.url)')
echo "✅ Deployment complete!"
echo "🌐 Access your app at: $FRONTEND_URL"
```

```bash
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

---

## Monitoring & Logs

### View Logs
```bash
# Backend logs
gcloud run logs read backend --region=$REGION --limit=50

# AI diagnosis logs
gcloud run logs read ai-diagnosis --region=$REGION --limit=50

# Frontend logs
gcloud run logs read frontend --region=$REGION --limit=50

# Stream live logs
gcloud run logs tail backend --region=$REGION
```

### Monitor Usage
```bash
# Check service metrics
gcloud run services describe backend --region=$REGION

# View billing
gcloud beta billing projects describe $PROJECT_ID
```

---

## Troubleshooting

### Service won't start
```bash
# Check logs for errors
gcloud run logs read backend --region=$REGION --limit=100

# Test locally first
docker run -p 8080:8080 ${IMAGE_PREFIX}/backend:latest
```

### Cold start too slow
- Increase CPU allocation: `--cpu=2`
- Increase memory: `--memory=1Gi`
- Set min-instances=1 for critical services (costs more)

### Database connection issues
```bash
# Test Cloud SQL connection
gcloud sql connect incident-db --user=appuser

# Check connection name
gcloud sql instances describe incident-db --format='value(connectionName)'
```

### Secret access denied
```bash
# Grant Cloud Run access
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Updates & Maintenance

### Deploy New Version
```bash
# Build new image
docker build -t ${IMAGE_PREFIX}/backend:v2 ./backend
docker push ${IMAGE_PREFIX}/backend:v2

# Deploy with zero-downtime
gcloud run deploy backend \
  --image=${IMAGE_PREFIX}/backend:v2 \
  --region=$REGION
```

### Rollback
```bash
# List revisions
gcloud run revisions list --service=backend --region=$REGION

# Rollback to previous version
gcloud run services update-traffic backend \
  --to-revisions=backend-00001-xyz=100 \
  --region=$REGION
```

### Scale to Zero Immediately
```bash
# Force scale down (for testing)
gcloud run services update backend \
  --max-instances=0 \
  --region=$REGION

# Re-enable
gcloud run services update backend \
  --max-instances=10 \
  --region=$REGION
```

---

## Alternative: Even Cheaper Option

### Use Cloud Run with SQLite (No Cloud SQL)

Modify backend to use **SQLite** instead of PostgreSQL:

**Cost**: **$0.50-1/month** (Cloud Run only)

```go
// In backend/main.go
db, err := gorm.Open(sqlite.Open("incidents.db"), &gorm.Config{})
```

**Trade-offs**:
- ❌ Data lost when service scales to zero
- ✅ Cheapest option
- ✅ Good for demos/testing

---

## Comparison: Cloud Run vs GKE

| Feature | Cloud Run | GKE |
|---------|-----------|-----|
| **Cost (2h/month)** | $1-4 | $100 |
| **Setup Time** | 30 min | 2-3 hours |
| **Scales to Zero** | ✅ Yes | ❌ No |
| **Cold Start** | 1-2s | N/A |
| **Management** | Minimal | Complex |
| **Best For** | Low traffic | High traffic |

---

## Next Steps

1. ✅ Run through Steps 1-11
2. ✅ Test the deployed application
3. ✅ Monitor costs in Cloud Console
4. ✅ Set up budget alerts (optional)
5. ✅ Configure custom domain (optional)

---

## Budget Alert (Recommended)

```bash
# Set budget alert at $5/month
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Cloud Run Budget" \
  --budget-amount=5 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

---

**Your app will now cost ~$1-4/month instead of $100/month!** 🎉

For questions or issues, check Cloud Run docs: https://cloud.google.com/run/docs

