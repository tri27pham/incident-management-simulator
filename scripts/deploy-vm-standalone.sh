#!/bin/bash

#############################################################################
# Deploy Incident Management Simulator to GCP VM with Containerized PostgreSQL
# 
# This script:
# - Creates a GCE VM with persistent disk for database
# - Installs Docker & Docker Compose
# - Deploys your entire stack (including PostgreSQL in Docker)
# - Configures auto-restart on boot
# - Sets up firewall rules
# - Runs 24/7 for ~$16/month
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="us-east1"
ZONE="us-east1-b"
VM_NAME="incident-simulator"
MACHINE_TYPE="e2-medium"  # 2 vCPU, 4GB RAM - perfect for your stack
DISK_SIZE="20GB"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

# Print section header
print_section() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# Print success message
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error message
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

#############################################################################
# Pre-flight checks
#############################################################################
print_section "Pre-Flight Checks"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
print_success "gcloud CLI found"

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    print_error "Not logged into gcloud. Run: gcloud auth login"
    exit 1
fi
print_success "Authenticated to GCP"

# Check project ID
if [ -z "$PROJECT_ID" ]; then
    print_error "No GCP project selected. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi
print_success "Project: $PROJECT_ID"

# Check .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Check for at least one API key
if ! grep -q "GROQ_API_KEY=.\+" .env && ! grep -q "GEMINI_API_KEY=.\+" .env; then
    print_error "No API key found in .env. Please add GROQ_API_KEY or GEMINI_API_KEY"
    exit 1
fi
print_success ".env file configured"

# Enable Secret Manager API
echo ""
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID 2>/dev/null || true
print_success "Secret Manager API enabled"

# Store API keys in Secret Manager
echo ""
echo "Storing API keys in Secret Manager..."

# Extract keys from .env
GROQ_KEY=$(grep "^GROQ_API_KEY=" .env | cut -d'=' -f2- | tr -d '\n\r' | xargs)
GEMINI_KEY=$(grep "^GEMINI_API_KEY=" .env | cut -d'=' -f2- | tr -d '\n\r' | xargs)
APP_PASSWORD=$(grep "^VITE_APP_PASSWORD=" .env | cut -d'=' -f2- | tr -d '\n\r' | xargs)

# Store GROQ_API_KEY if present
if [ ! -z "$GROQ_KEY" ]; then
    echo "  Storing GROQ_API_KEY..."
    echo -n "$GROQ_KEY" | gcloud secrets create groq-api-key \
        --data-file=- \
        --replication-policy="automatic" \
        --project=$PROJECT_ID 2>/dev/null || \
    echo -n "$GROQ_KEY" | gcloud secrets versions add groq-api-key \
        --data-file=- \
        --project=$PROJECT_ID
    print_success "  GROQ_API_KEY stored"
fi

# Store GEMINI_API_KEY if present
if [ ! -z "$GEMINI_KEY" ]; then
    echo "  Storing GEMINI_API_KEY..."
    echo -n "$GEMINI_KEY" | gcloud secrets create gemini-api-key \
        --data-file=- \
        --replication-policy="automatic" \
        --project=$PROJECT_ID 2>/dev/null || \
    echo -n "$GEMINI_KEY" | gcloud secrets versions add gemini-api-key \
        --data-file=- \
        --project=$PROJECT_ID
    print_success "  GEMINI_API_KEY stored"
fi

# Store VITE_APP_PASSWORD if present
if [ ! -z "$APP_PASSWORD" ]; then
    echo "  Storing VITE_APP_PASSWORD..."
    echo -n "$APP_PASSWORD" | gcloud secrets create app-password \
        --data-file=- \
        --replication-policy="automatic" \
        --project=$PROJECT_ID 2>/dev/null || \
    echo -n "$APP_PASSWORD" | gcloud secrets versions add app-password \
        --data-file=- \
        --project=$PROJECT_ID
    print_success "  VITE_APP_PASSWORD stored"
fi

print_success "API keys securely stored in Secret Manager"

echo ""
echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Project:      $PROJECT_ID"
echo "  Region:       $REGION"
echo "  Zone:         $ZONE"
echo "  VM Name:      $VM_NAME"
echo "  Machine Type: $MACHINE_TYPE (2 vCPU, 4GB RAM)"
echo "  Disk Size:    $DISK_SIZE"
echo "  Cost:         ~\$16/month (24/7)"
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

#############################################################################
# Create VM with persistent disk
#############################################################################
print_section "Creating VM Instance"

# Check if VM already exists
if gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    print_warning "VM '$VM_NAME' already exists in zone $ZONE"
    read -p "Delete existing VM and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting existing VM..."
        gcloud compute instances delete $VM_NAME --zone=$ZONE --quiet
        print_success "Existing VM deleted"
    else
        print_error "Cannot proceed with existing VM. Exiting."
        exit 1
    fi
fi

echo "Creating VM instance (this takes ~60 seconds)..."

gcloud compute instances create $VM_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --tags=incident-simulator,http-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=$VM_NAME,image=projects/$IMAGE_PROJECT/global/images/family/$IMAGE_FAMILY,mode=rw,size=$DISK_SIZE,type=projects/$PROJECT_ID/zones/$ZONE/diskTypes/pd-balanced \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --metadata=startup-script='#!/bin/bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $(whoami)

# Install Docker Compose
apt-get update
apt-get install -y docker-compose-plugin

# Enable Docker to start on boot
systemctl enable docker
systemctl start docker

echo "Docker installation complete"
' \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=project=incident-simulator \
    --reservation-affinity=any

print_success "VM created successfully"

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
print_success "External IP: $EXTERNAL_IP"

#############################################################################
# Configure firewall rules
#############################################################################
print_section "Configuring Firewall"

# Create firewall rule for frontend (port 3000)
if ! gcloud compute firewall-rules describe allow-incident-frontend &>/dev/null; then
    echo "Creating firewall rule for frontend (port 3000)..."
    gcloud compute firewall-rules create allow-incident-frontend \
        --project=$PROJECT_ID \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:3000 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=incident-simulator
    print_success "Frontend firewall rule created"
else
    print_success "Frontend firewall rule already exists"
fi

# Create firewall rule for backend (port 8080)
if ! gcloud compute firewall-rules describe allow-incident-backend &>/dev/null; then
    echo "Creating firewall rule for backend (port 8080)..."
    gcloud compute firewall-rules create allow-incident-backend \
        --project=$PROJECT_ID \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:8080 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=incident-simulator
    print_success "Backend firewall rule created"
else
    print_success "Backend firewall rule already exists"
fi

#############################################################################
# Wait for VM to be ready
#############################################################################
print_section "Waiting for VM to be Ready"

echo "Waiting for Docker installation (this takes ~90 seconds)..."
sleep 90

# Wait for VM to be SSH-ready
echo "Testing SSH connection..."
max_attempts=12
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if gcloud compute ssh $VM_NAME --zone=$ZONE --command="echo 'SSH ready'" --quiet 2>/dev/null; then
        print_success "VM is ready"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        print_error "VM not responding to SSH after $max_attempts attempts"
        exit 1
    fi
    echo "Attempt $attempt/$max_attempts - waiting..."
    sleep 10
done

# Wait for Docker to be ready
echo "Verifying Docker installation..."
max_attempts=6
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if gcloud compute ssh $VM_NAME --zone=$ZONE --command="sudo docker ps" --quiet 2>/dev/null; then
        print_success "Docker is ready"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        print_error "Docker not responding after $max_attempts attempts"
        exit 1
    fi
    echo "Attempt $attempt/$max_attempts - waiting for Docker..."
    sleep 10
done

#############################################################################
# Deploy application to VM
#############################################################################
print_section "Deploying Application"

echo "Preparing deployment package..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)

# Copy necessary files (exclude large/unnecessary files)
echo "Copying project files..."
rsync -a \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'build' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude '*.pid' \
    --exclude 'logs/' \
    --exclude '.vscode' \
    --exclude '.idea' \
    --exclude 'venv' \
    --exclude '*.md' \
    --exclude '.env' \
    --exclude '.env.*' \
    ./ $TEMP_DIR/ 2>/dev/null | tail -20

echo "Note: API keys will be fetched from Secret Manager on VM"

# Create tar archive (faster transfer)
echo "Creating archive..."
cd $TEMP_DIR
tar -czf /tmp/app-deploy.tar.gz $(ls -A) 2>/dev/null
cd - > /dev/null

echo "Uploading to VM (~30 seconds)..."

# Create directory on VM
gcloud compute ssh $VM_NAME --zone=$ZONE --command="mkdir -p /tmp/app" --quiet 2>/dev/null || true

# Upload tar file (much faster than recursive copy)
gcloud compute scp --zone=$ZONE /tmp/app-deploy.tar.gz $VM_NAME:/tmp/app-deploy.tar.gz --quiet

# Extract on VM
echo "Extracting files on VM..."
gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
    cd /tmp/app
    tar -xzf /tmp/app-deploy.tar.gz
    rm /tmp/app-deploy.tar.gz
"

# Clean up temp files
rm -rf $TEMP_DIR
rm -f /tmp/app-deploy.tar.gz

print_success "Files uploaded"

#############################################################################
# Set up and start application
#############################################################################
print_section "Starting Application"

echo "Setting up application on VM..."

gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
    set -e
    
    # Move to permanent location
    sudo mkdir -p /opt/incident-simulator
    sudo cp -r /tmp/app/* /opt/incident-simulator/
    sudo rm -rf /tmp/app
    
    # Set permissions
    sudo chown -R \$(whoami):\$(whoami) /opt/incident-simulator
    
    # Navigate to app directory
    cd /opt/incident-simulator
    
    # Create .env file from Secret Manager
    echo 'Fetching secrets from Secret Manager...'
    
    # Fetch secrets and create .env
    cat > .env << 'ENVFILE'
# Database (auto-configured in Docker)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=incidentuser
POSTGRES_PASSWORD=incidentpass
POSTGRES_DB=incidentdb

# Backend
DB_HOST=postgres
DB_PORT=5432
DB_USER=incidentuser
DB_PASSWORD=incidentpass
DB_NAME=incidentdb

# Health Monitor
HEALTH_MONITOR_PORT=8002
ENVFILE

    # Add API keys from Secret Manager
    GROQ_KEY=\$(gcloud secrets versions access latest --secret=groq-api-key --project=$PROJECT_ID 2>/dev/null || echo '')
    if [ ! -z \"\$GROQ_KEY\" ]; then
        echo \"GROQ_API_KEY=\$GROQ_KEY\" >> .env
        echo '✓ GROQ_API_KEY retrieved'
    fi
    
    GEMINI_KEY=\$(gcloud secrets versions access latest --secret=gemini-api-key --project=$PROJECT_ID 2>/dev/null || echo '')
    if [ ! -z \"\$GEMINI_KEY\" ]; then
        echo \"GEMINI_API_KEY=\$GEMINI_KEY\" >> .env
        echo '✓ GEMINI_API_KEY retrieved'
    fi
    
    APP_PASS=\$(gcloud secrets versions access latest --secret=app-password --project=$PROJECT_ID 2>/dev/null || echo 'changeme')
    echo \"VITE_APP_PASSWORD=\$APP_PASS\" >> .env
    echo '✓ VITE_APP_PASSWORD retrieved'
    
    # Add frontend API URL pointing to VM's public IP
    EXTERNAL_IP=\$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H \"Metadata-Flavor: Google\")
    echo \"VITE_API_URL=http://\$EXTERNAL_IP:8080/api/v1\" >> .env
    echo \"✓ VITE_API_URL configured for external access: http://\$EXTERNAL_IP:8080/api/v1\"
    
    chmod 600 .env
    echo '✓ .env file created from Secret Manager'
    
    # Start Docker Compose services
    echo 'Starting Docker Compose services...'
    sudo docker compose up -d --build
    
    echo '✓ Services started'
    
    # Set up auto-restart on boot
    echo 'Setting up auto-restart on boot...'
    sudo tee /etc/systemd/system/incident-simulator.service > /dev/null <<EOF
[Unit]
Description=Incident Management Simulator
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/incident-simulator
ExecStartPre=/bin/bash -c 'cd /opt/incident-simulator && gcloud secrets versions access latest --secret=groq-api-key --project=$PROJECT_ID 2>/dev/null | sed \"s/^/GROQ_API_KEY=/\" > .env.tmp || true'
ExecStartPre=/bin/bash -c 'cd /opt/incident-simulator && gcloud secrets versions access latest --secret=gemini-api-key --project=$PROJECT_ID 2>/dev/null | sed \"s/^/GEMINI_API_KEY=/\" >> .env.tmp || true'
ExecStartPre=/bin/bash -c 'cd /opt/incident-simulator && gcloud secrets versions access latest --secret=app-password --project=$PROJECT_ID 2>/dev/null | sed \"s/^/VITE_APP_PASSWORD=/\" >> .env.tmp || true'
ExecStartPre=/bin/bash -c 'cd /opt/incident-simulator && EXTERNAL_IP=\\$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H \"Metadata-Flavor: Google\") && echo \"VITE_API_URL=http://\\$EXTERNAL_IP:8080/api/v1\" >> .env.tmp'
ExecStartPre=/bin/bash -c 'cd /opt/incident-simulator && cat .env.static .env.tmp > .env 2>/dev/null && rm -f .env.tmp'
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    # Create static env file
    cat > /opt/incident-simulator/.env.static << 'STATICENV'
# Database (auto-configured in Docker)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=incidentuser
POSTGRES_PASSWORD=incidentpass
POSTGRES_DB=incidentdb

# Backend
DB_HOST=postgres
DB_PORT=5432
DB_USER=incidentuser
DB_PASSWORD=incidentpass
DB_NAME=incidentdb

# Health Monitor
HEALTH_MONITOR_PORT=8002

# Frontend API URL (will be appended from metadata)
STATICENV

    sudo systemctl daemon-reload
    sudo systemctl enable incident-simulator.service
    
    echo '✓ Auto-restart configured'
"

print_success "Application deployed and started"

#############################################################################
# Verify deployment
#############################################################################
print_section "Verifying Deployment"

echo "Waiting for services to start (30 seconds)..."
sleep 30

echo "Checking service health..."

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://$EXTERNAL_IP:3000 | grep -q "200\|301\|302"; then
    print_success "Frontend is responding"
else
    print_warning "Frontend not responding yet (may need more time)"
fi

# Check backend
if curl -s http://$EXTERNAL_IP:8080/health | grep -q "ok"; then
    print_success "Backend is healthy"
else
    print_warning "Backend not responding yet (may need more time)"
fi

#############################################################################
# Display results
#############################################################################
print_section "Deployment Complete!"

echo -e "${GREEN}Your Incident Management Simulator is now running!${NC}"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo -e "  Frontend:  ${BLUE}http://$EXTERNAL_IP:3000${NC}"
echo -e "  Backend:   ${BLUE}http://$EXTERNAL_IP:8080${NC}"
echo ""
echo -e "${YELLOW}Credentials:${NC}"
echo "  Password: (check your .env file for VITE_APP_PASSWORD, default: changeme)"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  SSH to VM:       gcloud compute ssh $VM_NAME --zone=$ZONE"
echo "  View logs:       gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd /opt/incident-simulator && sudo docker compose logs -f'"
echo "  Restart:         gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd /opt/incident-simulator && sudo docker compose restart'"
echo "  Stop VM:         gcloud compute instances stop $VM_NAME --zone=$ZONE"
echo "  Start VM:        gcloud compute instances start $VM_NAME --zone=$ZONE"
echo "  Delete VM:       ./scripts/cleanup-vm-standalone.sh"
echo ""
echo -e "${YELLOW}Cost Information:${NC}"
echo "  Running 24/7: ~\$16/month"
echo "  VM will auto-restart on boot"
echo "  Database data persists in Docker volume"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit http://$EXTERNAL_IP:3000 in your browser"
echo "  2. Log in with your password"
echo "  3. Test incident generation and failure injection"
echo "  4. Set up backups (optional): ./scripts/setup-backups.sh"
echo ""
print_success "Deployment successful! 🚀"

