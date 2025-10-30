# GKE Deployment Guide
**Incident Management Simulator**

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **kubectl** installed
4. **Docker** (for building images)
5. **API Keys**:
   - Groq API Key (https://console.groq.com)
   - Gemini API Key (https://aistudio.google.com/app/apikey)

---

## Step 1: Set Up GCP Project

```bash
# Set variables
export PROJECT_ID="incident-simulator-prod"
export REGION="us-central1"
export CLUSTER_NAME="incident-simulator-cluster"

# Create project (if new)
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

---

## Step 2: Create GKE Cluster

```bash
# Create GKE cluster (autopilot for simplicity)
gcloud container clusters create-auto $CLUSTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID

# Get credentials
gcloud container clusters get-credentials $CLUSTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID

# Verify connection
kubectl cluster-info
```

**Alternative: Standard GKE Cluster** (for more control):
```bash
gcloud container clusters create $CLUSTER_NAME \
  --region=$REGION \
  --num-nodes=2 \
  --machine-type=e2-medium \
  --disk-size=20GB \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=4
```

---

## Step 3: Set Up Artifact Registry

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

## Step 4: Build and Push Docker Images

```bash
# Set image prefix
export IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/incident-simulator"

# Build and push frontend
docker build -t ${IMAGE_PREFIX}/frontend:latest ./frontend
docker push ${IMAGE_PREFIX}/frontend:latest

# Build and push backend
docker build -t ${IMAGE_PREFIX}/backend:latest ./backend
docker push ${IMAGE_PREFIX}/backend:latest

# Build and push AI diagnosis service
docker build -t ${IMAGE_PREFIX}/ai-diagnosis:latest ./ai-diagnosis
docker push ${IMAGE_PREFIX}/ai-diagnosis:latest

# Build and push health monitor
docker build -t ${IMAGE_PREFIX}/health-monitor:latest ./health-monitor
docker push ${IMAGE_PREFIX}/health-monitor:latest

# Build and push incident generator
docker build -t ${IMAGE_PREFIX}/incident-generator:latest ./incident-generator
docker push ${IMAGE_PREFIX}/incident-generator:latest
```

---

## Step 5: Set Up Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create incident-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create incidents --instance=incident-db

# Create user
gcloud sql users create appuser \
  --instance=incident-db \
  --password=YOUR_APP_PASSWORD

# Get connection name
export SQL_CONNECTION_NAME=$(gcloud sql instances describe incident-db --format='value(connectionName)')
echo "SQL Connection Name: $SQL_CONNECTION_NAME"
```

**For testing/dev**: Use in-cluster PostgreSQL instead (see kubernetes/postgres.yaml)

---

## Step 6: Create Kubernetes Secrets

```bash
# Create secrets for sensitive data
kubectl create secret generic app-secrets \
  --from-literal=app-password=YOUR_APP_PASSWORD \
  --from-literal=groq-api-key=YOUR_GROQ_KEY \
  --from-literal=gemini-api-key=YOUR_GEMINI_KEY \
  --from-literal=db-password=YOUR_DB_PASSWORD

# Verify secret
kubectl get secrets
```

---

## Step 7: Create Kubernetes Manifests

Create a `kubernetes/` directory with the following files:

### 7.1: `namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: incident-simulator
```

### 7.2: `postgres.yaml` (In-cluster DB for testing)
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: incident-simulator
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: incident-simulator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: "incidents"
        - name: POSTGRES_USER
          value: "appuser"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: incident-simulator
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### 7.3: `backend.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: incident-simulator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: us-central1-docker.pkg.dev/YOUR_PROJECT/incident-simulator/backend:latest
        env:
        - name: DATABASE_URL
          value: "postgres://appuser:$(DB_PASSWORD)@postgres:5432/incidents?sslmode=disable"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db-password
        - name: AI_DIAGNOSIS_URL
          value: "http://ai-diagnosis:8000"
        - name: HEALTH_MONITOR_URL
          value: "http://health-monitor:8002"
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: incident-simulator
spec:
  selector:
    app: backend
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

### 7.4: `frontend.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: incident-simulator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: us-central1-docker.pkg.dev/YOUR_PROJECT/incident-simulator/frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: incident-simulator
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

### 7.5: `ai-diagnosis.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-diagnosis
  namespace: incident-simulator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ai-diagnosis
  template:
    metadata:
      labels:
        app: ai-diagnosis
    spec:
      containers:
      - name: ai-diagnosis
        image: us-central1-docker.pkg.dev/YOUR_PROJECT/incident-simulator/ai-diagnosis:latest
        env:
        - name: GROQ_API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: groq-api-key
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: gemini-api-key
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: ai-diagnosis
  namespace: incident-simulator
spec:
  selector:
    app: ai-diagnosis
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### 7.6: `health-monitor.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: health-monitor
  namespace: incident-simulator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: health-monitor
  template:
    metadata:
      labels:
        app: health-monitor
    spec:
      containers:
      - name: health-monitor
        image: us-central1-docker.pkg.dev/YOUR_PROJECT/incident-simulator/health-monitor:latest
        env:
        - name: BACKEND_URL
          value: "http://backend:8080"
        - name: REDIS_HOST
          value: "redis-test"
        - name: POSTGRES_HOST
          value: "postgres-test"
        ports:
        - containerPort: 8002
        resources:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: health-monitor
  namespace: incident-simulator
spec:
  selector:
    app: health-monitor
  ports:
  - port: 8002
    targetPort: 8002
  type: ClusterIP
```

### 7.7: `mock-systems.yaml` (Redis & PostgreSQL Test Instances)
```yaml
# Redis Test
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-test
  namespace: incident-simulator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis-test
  template:
    metadata:
      labels:
        app: redis-test
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        args:
        - redis-server
        - --maxmemory
        - 50mb
        - --maxmemory-policy
        - noeviction
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis-test
  namespace: incident-simulator
spec:
  selector:
    app: redis-test
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
---
# PostgreSQL Test
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-test
  namespace: incident-simulator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-test
  template:
    metadata:
      labels:
        app: postgres-test
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: "testdb"
        - name: POSTGRES_USER
          value: "testuser"
        - name: POSTGRES_PASSWORD
          value: "testpass"
        ports:
        - containerPort: 5432
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-test
  namespace: incident-simulator
spec:
  selector:
    app: postgres-test
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### 7.8: `configmap.yaml` (Environment Config)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: incident-simulator
data:
  APP_PASSWORD: "change-me-in-production"
  VITE_API_URL: "http://backend:8080/api/v1"
  VITE_WS_URL: "ws://backend:8080/ws"
```

---

## Step 8: Deploy to GKE

```bash
# Apply all manifests
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/backend.yaml
kubectl apply -f kubernetes/ai-diagnosis.yaml
kubectl apply -f kubernetes/health-monitor.yaml
kubectl apply -f kubernetes/mock-systems.yaml
kubectl apply -f kubernetes/frontend.yaml

# Check deployment status
kubectl get pods -n incident-simulator
kubectl get services -n incident-simulator

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=backend -n incident-simulator --timeout=300s
```

---

## Step 9: Access the Application

```bash
# Get external IP for frontend
kubectl get service frontend -n incident-simulator

# Wait for EXTERNAL-IP to be assigned (may take 2-5 minutes)
# Then access: http://<EXTERNAL-IP>

# For testing with port-forward (no LoadBalancer)
kubectl port-forward -n incident-simulator service/frontend 3000:80
# Access: http://localhost:3000
```

---

## Step 10: Configure Domain & SSL (Optional)

### Using Google Cloud Load Balancer + Managed Certificate:

```bash
# Reserve static IP
gcloud compute addresses create incident-simulator-ip \
  --global

# Get the IP
gcloud compute addresses describe incident-simulator-ip \
  --global --format="get(address)"

# Create managed certificate
gcloud compute ssl-certificates create incident-simulator-cert \
  --domains=incident-simulator.your-domain.com \
  --global
```

Create `ingress.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: incident-simulator-ingress
  namespace: incident-simulator
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "incident-simulator-ip"
    networking.gke.io/managed-certificates: "incident-simulator-cert"
    kubernetes.io/ingress.class: "gce"
spec:
  rules:
  - host: incident-simulator.your-domain.com
    http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: frontend
            port:
              number: 80
```

```bash
kubectl apply -f kubernetes/ingress.yaml
```

---

## Step 11: Monitoring & Logging

### Enable GCP Monitoring:
```bash
# GKE sends logs to Cloud Logging automatically
# View logs:
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=incident-simulator" --limit 50

# View metrics in Cloud Console:
# https://console.cloud.google.com/monitoring
```

### Set up alerts:
- Pod crash alerts
- High memory/CPU usage
- Failed deployment alerts

---

## Step 12: Scaling & Autoscaling

```bash
# Manual scaling
kubectl scale deployment backend --replicas=3 -n incident-simulator

# Horizontal Pod Autoscaler (HPA)
kubectl autoscale deployment backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n incident-simulator

# Check HPA status
kubectl get hpa -n incident-simulator
```

---

## Maintenance Commands

```bash
# View logs
kubectl logs -f deployment/backend -n incident-simulator

# Execute commands in pod
kubectl exec -it deployment/backend -n incident-simulator -- /bin/sh

# Restart deployment
kubectl rollout restart deployment/backend -n incident-simulator

# Check resource usage
kubectl top pods -n incident-simulator
kubectl top nodes

# Delete everything
kubectl delete namespace incident-simulator
```

---

## Cost Optimization

1. **Use Autopilot GKE** for automatic resource management
2. **Use Preemptible VMs** for non-critical workloads
3. **Set resource limits** to prevent over-provisioning
4. **Use Cloud SQL f1-micro** tier for testing
5. **Configure autoscaling** to scale down during low traffic
6. **Use regional clusters** (cheaper than multi-region)

**Estimated Monthly Cost (us-central1)**:
- GKE Autopilot: ~$74/month (0.10/hour)
- Cloud SQL (f1-micro): ~$10/month
- LoadBalancer: ~$18/month
- **Total: ~$100/month**

For testing, use in-cluster PostgreSQL to save Cloud SQL costs (~$10).

---

## Troubleshooting

### Pods not starting:
```bash
kubectl describe pod <pod-name> -n incident-simulator
kubectl logs <pod-name> -n incident-simulator --previous
```

### Database connection issues:
```bash
# Test from backend pod
kubectl exec -it deployment/backend -n incident-simulator -- /bin/sh
nc -zv postgres 5432
```

### Image pull errors:
```bash
# Ensure Artifact Registry permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:<compute-sa>@developer.gserviceaccount.com \
  --role=roles/artifactregistry.reader
```

### Out of memory:
```bash
# Increase memory limits in deployment YAML
resources:
  limits:
    memory: 1Gi  # Increase this
```

---

## Security Best Practices

1. ✅ **Use Secrets** for sensitive data (API keys, passwords)
2. ✅ **Enable Network Policies** to restrict pod-to-pod communication
3. ✅ **Use RBAC** for fine-grained access control
4. ✅ **Enable Binary Authorization** to ensure only trusted images
5. ✅ **Rotate secrets** regularly
6. ✅ **Use private GKE cluster** for production
7. ✅ **Enable Workload Identity** instead of service account keys

---

## Next Steps

1. Set up CI/CD pipeline (Cloud Build, GitHub Actions)
2. Implement blue-green or canary deployments
3. Configure backup strategy for Cloud SQL
4. Set up custom domain with SSL
5. Implement rate limiting and DDoS protection
6. Add observability (Prometheus, Grafana)

---

**Deployment Complete!** 🚀

Your Incident Management Simulator is now running on GKE.

For support: Check logs, review the DEPLOYMENT_TEST_REPORT.md, or consult GCP documentation.

