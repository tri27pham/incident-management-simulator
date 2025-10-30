# CI/CD Setup Guide
**Automated Deployment from GitHub to Cloud Run**

---

## Options for CI/CD

### 1. **Cloud Build + GitHub** (Recommended)
- ✅ Native GCP integration
- ✅ Automatic deployments on push
- ✅ Free tier: 120 build-minutes/day
- ✅ Built-in Docker image caching

### 2. **GitHub Actions**
- ✅ More flexible workflows
- ✅ Free for public repos (2,000 min/month)
- ✅ Familiar GitHub interface
- ✅ Better for multi-cloud

---

## Option 1: Cloud Build (Easiest)

### Step 1: Enable Cloud Build

```bash
# Enable APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# Grant Cloud Build permissions to deploy to Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Step 2: Connect GitHub Repository

```bash
# Connect GitHub repo via Cloud Build
gcloud builds triggers create github \
  --repo-name=incident-management-simulator \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

Or use the Console:
1. Go to https://console.cloud.google.com/cloud-build/triggers
2. Click "Connect Repository"
3. Select "GitHub" and authorize
4. Choose your repository
5. Select branch: `main`

### Step 3: Create `cloudbuild.yaml`

```yaml
# cloudbuild.yaml
steps:
  # Build Backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/backend:$SHORT_SHA', './backend']
  
  # Build AI Diagnosis
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/ai-diagnosis:$SHORT_SHA', './ai-diagnosis']
  
  # Build Health Monitor
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/health-monitor:$SHORT_SHA', './health-monitor']
  
  # Build Frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/frontend:$SHORT_SHA', './frontend']
  
  # Push Backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/backend:$SHORT_SHA']
  
  # Push AI Diagnosis
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/ai-diagnosis:$SHORT_SHA']
  
  # Push Health Monitor
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/health-monitor:$SHORT_SHA']
  
  # Push Frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/frontend:$SHORT_SHA']
  
  # Deploy Backend
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'backend'
      - '--image=${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/backend:$SHORT_SHA'
      - '--region=${_REGION}'
      - '--platform=managed'
      - '--min-instances=0'
  
  # Deploy AI Diagnosis
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'ai-diagnosis'
      - '--image=${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/ai-diagnosis:$SHORT_SHA'
      - '--region=${_REGION}'
      - '--platform=managed'
      - '--min-instances=0'
  
  # Deploy Health Monitor
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'health-monitor'
      - '--image=${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/health-monitor:$SHORT_SHA'
      - '--region=${_REGION}'
      - '--platform=managed'
      - '--min-instances=0'
  
  # Deploy Frontend
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'frontend'
      - '--image=${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/frontend:$SHORT_SHA'
      - '--region=${_REGION}'
      - '--platform=managed'
      - '--min-instances=0'

substitutions:
  _REGION: us-central1
  _REPO: incident-simulator

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: 1800s  # 30 minutes
```

### Step 4: Test the Pipeline

```bash
# Commit and push
git add cloudbuild.yaml
git commit -m "ci: add Cloud Build CI/CD pipeline"
git push origin main

# View build progress
gcloud builds list --limit=5
gcloud builds log $(gcloud builds list --limit=1 --format='value(ID)')
```

**Result**: Every push to `main` automatically deploys to Cloud Run! 🎉

---

## Option 2: GitHub Actions (More Flexible)

### Step 1: Create Service Account

```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
PROJECT_ID=$(gcloud config get-value project)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Copy the key content
cat github-actions-key.json
```

### Step 2: Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/incident-management-simulator/settings/secrets/actions`

Add these secrets:
- **`GCP_PROJECT_ID`**: Your GCP project ID
- **`GCP_SA_KEY`**: Contents of `github-actions-key.json`
- **`GCP_REGION`**: `us-central1`

### Step 3: Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: ${{ secrets.GCP_REGION }}
  REPO: incident-simulator

jobs:
  setup-build-deploy:
    name: Setup, Build, and Deploy
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    # Authenticate with GCP
    - name: Authenticate to Google Cloud
      uses: google-github-actions/auth@v1
      with:
        credentials_json: ${{ secrets.GCP_SA_KEY }}

    # Setup gcloud CLI
    - name: Set up Cloud SDK
      uses: google-github-actions/setup-gcloud@v1

    # Configure Docker to use gcloud as credential helper
    - name: Configure Docker
      run: |
        gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

    # Build Backend
    - name: Build Backend Image
      run: |
        docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/backend:${{ github.sha }} ./backend
        docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/backend:${{ github.sha }}

    # Build AI Diagnosis
    - name: Build AI Diagnosis Image
      run: |
        docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/ai-diagnosis:${{ github.sha }} ./ai-diagnosis
        docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/ai-diagnosis:${{ github.sha }}

    # Build Health Monitor
    - name: Build Health Monitor Image
      run: |
        docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/health-monitor:${{ github.sha }} ./health-monitor
        docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/health-monitor:${{ github.sha }}

    # Build Frontend
    - name: Build Frontend Image
      run: |
        docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/frontend:${{ github.sha }} ./frontend
        docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/frontend:${{ github.sha }}

    # Deploy Backend
    - name: Deploy Backend to Cloud Run
      run: |
        gcloud run deploy backend \
          --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/backend:${{ github.sha }} \
          --region=${{ env.REGION }} \
          --platform=managed \
          --min-instances=0

    # Deploy AI Diagnosis
    - name: Deploy AI Diagnosis to Cloud Run
      run: |
        gcloud run deploy ai-diagnosis \
          --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/ai-diagnosis:${{ github.sha }} \
          --region=${{ env.REGION }} \
          --platform=managed \
          --min-instances=0

    # Deploy Health Monitor
    - name: Deploy Health Monitor to Cloud Run
      run: |
        gcloud run deploy health-monitor \
          --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/health-monitor:${{ github.sha }} \
          --region=${{ env.REGION }} \
          --platform=managed \
          --min-instances=0

    # Deploy Frontend
    - name: Deploy Frontend to Cloud Run
      run: |
        gcloud run deploy frontend \
          --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO }}/frontend:${{ github.sha }} \
          --region=${{ env.REGION }} \
          --platform=managed \
          --min-instances=0

    # Output URLs
    - name: Get Service URLs
      run: |
        echo "Frontend URL: $(gcloud run services describe frontend --region=${{ env.REGION }} --format='value(status.url)')"
        echo "Backend URL: $(gcloud run services describe backend --region=${{ env.REGION }} --format='value(status.url)')"
```

### Step 4: Test the Pipeline

```bash
# Commit and push
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions CI/CD pipeline"
git push origin main

# View in GitHub
# Go to: https://github.com/YOUR_USERNAME/incident-management-simulator/actions
```

---

## Advanced: Multi-Environment Setup

### For Staging + Production

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [ dev ]

# ... same as above but deploy to staging services
```

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
    tags:
      - 'v*'

# ... deploy to production services
```

---

## Comparison: Cloud Build vs GitHub Actions

| Feature | Cloud Build | GitHub Actions |
|---------|-------------|----------------|
| **Setup** | Easier | More config |
| **Cost** | 120 min/day free | 2,000 min/month free |
| **Speed** | Faster (GCP network) | Slightly slower |
| **Flexibility** | Limited | Very flexible |
| **Caching** | Built-in | Need to configure |
| **Best For** | GCP-only projects | Multi-cloud |

---

## Cost Impact of CI/CD

### Cloud Build
- **Free tier**: 120 build-minutes/day
- **Your usage**: ~10 min per deployment
- **Deployments/day**: 12 free, then $0.003/min

### GitHub Actions (Public Repo)
- **Free tier**: 2,000 minutes/month
- **Your usage**: ~10 min per deployment
- **Deployments/month**: 200 free

### Recommendation
Both are **FREE** for your use case! 🎉

Choose:
- **Cloud Build** if you only deploy to GCP (simpler)
- **GitHub Actions** if you want more control/flexibility

---

## Monitoring Deployments

### Cloud Build
```bash
# View recent builds
gcloud builds list --limit=10

# View build logs
gcloud builds log BUILD_ID --stream

# View in console
open https://console.cloud.google.com/cloud-build/builds
```

### GitHub Actions
```bash
# View in browser
open https://github.com/YOUR_USERNAME/incident-management-simulator/actions

# Or use GitHub CLI
gh run list
gh run view RUN_ID
gh run watch
```

---

## Rollback Strategy

### Automatic Rollback on Failure

Add to `cloudbuild.yaml`:
```yaml
# After each deploy step, add verification
- name: 'gcr.io/cloud-builders/gcloud'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      URL=$(gcloud run services describe backend --region=${_REGION} --format='value(status.url)')
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL/health || echo "000")
      if [ "$STATUS" != "200" ]; then
        echo "Health check failed, rolling back..."
        gcloud run services update-traffic backend --to-revisions=PREVIOUS=100 --region=${_REGION}
        exit 1
      fi
```

### Manual Rollback
```bash
# List revisions
gcloud run revisions list --service=backend --region=us-central1

# Rollback to previous version
gcloud run services update-traffic backend \
  --to-revisions=backend-00023-abc=100 \
  --region=us-central1
```

---

## Next Steps

1. ✅ Choose Cloud Build or GitHub Actions
2. ✅ Add secrets/configuration
3. ✅ Create workflow file
4. ✅ Test with a commit
5. ✅ Set up branch protection (optional)
6. ✅ Add status badges to README (optional)

---

## Status Badge (Optional)

### For GitHub Actions
Add to `README.md`:
```markdown
![Deploy to Cloud Run](https://github.com/YOUR_USERNAME/incident-management-simulator/workflows/Deploy%20to%20Cloud%20Run/badge.svg)
```

### For Cloud Build
Add to `README.md`:
```markdown
[![Cloud Build](https://storage.googleapis.com/YOUR_PROJECT_cloudbuild/logs/badge.svg)](https://console.cloud.google.com/cloud-build/builds?project=YOUR_PROJECT)
```

---

**Your deployments are now automated!** Every push to `main` will deploy to Cloud Run automatically. 🚀

