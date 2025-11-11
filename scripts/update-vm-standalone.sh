#!/bin/bash

#############################################################################
# Update Incident Management Simulator on Running VM
# 
# This script updates your application without losing database data
# 
# Options:
#   1. Pull from Git and rebuild
#   2. Upload local changes and rebuild
#   3. Restart services only (no rebuild)
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
ZONE="us-east1-b"
VM_NAME="incident-simulator"

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

#############################################################################
# Pre-flight checks
#############################################################################

if [ -z "$PROJECT_ID" ]; then
    print_error "No GCP project selected"
    exit 1
fi

# Check if VM exists
if ! gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    print_error "VM '$VM_NAME' not found in zone $ZONE"
    exit 1
fi

# Get VM external IP
EXTERNAL_IP=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

#############################################################################
# Show update options
#############################################################################

echo ""
echo -e "${BLUE}Update Options:${NC}"
echo ""
echo "  1) Pull from Git and rebuild (recommended if using GitHub)"
echo "  2) Upload local changes and rebuild"
echo "  3) Restart services only (no code changes)"
echo "  4) Cancel"
echo ""
read -p "Select option (1-4): " update_choice

case $update_choice in
    1)
        echo ""
        echo "Pulling from Git and rebuilding..."
        
        gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
            set -e
            cd /opt/incident-simulator
            
            echo 'Pulling latest changes...'
            git pull origin main || git pull origin master
            
            echo 'Rebuilding and restarting services...'
            sudo docker compose down
            sudo docker compose up -d --build
            
            echo '✓ Update complete'
        "
        
        print_success "Application updated from Git"
        ;;
        
    2)
        echo ""
        echo "Uploading local files and rebuilding..."
        
        # Create deployment package
        TEMP_DIR=$(mktemp -d)
        echo "Preparing deployment package..."
        
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
            ./ $TEMP_DIR/
        
        # Copy .env explicitly
        if [ -f .env ]; then
            echo "Copying .env file..."
            cp .env $TEMP_DIR/.env
            chmod 644 $TEMP_DIR/.env
        else
            print_warning ".env file not found - services may fail to start"
        fi
        
        echo "Creating archive..."
        cd $TEMP_DIR
        tar -czf /tmp/app-update.tar.gz $(ls -A) 2>/dev/null
        cd - > /dev/null
        
        echo "Uploading to VM..."
        gcloud compute ssh $VM_NAME --zone=$ZONE --command="sudo rm -rf /tmp/app && mkdir -p /tmp/app" --quiet
        gcloud compute scp --zone=$ZONE /tmp/app-update.tar.gz $VM_NAME:/tmp/app-update.tar.gz --quiet
        
        echo "Extracting on VM..."
        gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
            cd /tmp/app
            tar -xzf /tmp/app-update.tar.gz
            sudo rm /tmp/app-update.tar.gz
        "
        
        rm -rf $TEMP_DIR
        rm -f /tmp/app-update.tar.gz
        
        echo "Rebuilding services..."
        gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
            set -e
            cd /opt/incident-simulator
            
            # Stop services (keeps database volume intact)
            sudo docker compose down
            
            # Copy new files (preserve database volume)
            sudo rm -rf backend frontend ai-diagnosis health-monitor incident-generator scripts docker-compose.yml .env 2>/dev/null || true
            sudo cp -r /tmp/app/* /opt/incident-simulator/
            sudo cp /tmp/app/.env /opt/incident-simulator/.env 2>/dev/null || echo 'Warning: .env not found'
            sudo rm -rf /tmp/app
            
            # Verify .env exists
            if [ ! -f .env ]; then
                echo 'ERROR: .env file missing!'
                ls -la | head -20
                exit 1
            fi
            echo '✓ .env file verified'
            
            # Rebuild and start
            sudo docker compose up -d --build
            
            echo '✓ Update complete'
        "
        
        print_success "Application updated from local files"
        ;;
        
    3)
        echo ""
        echo "Restarting services..."
        
        gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
            cd /opt/incident-simulator
            sudo docker compose restart
            echo '✓ Services restarted'
        "
        
        print_success "Services restarted"
        ;;
        
    4)
        echo "Cancelled."
        exit 0
        ;;
        
    *)
        print_error "Invalid option"
        exit 1
        ;;
esac

#############################################################################
# Verify update
#############################################################################

echo ""
echo "Waiting for services to start (30 seconds)..."
sleep 30

echo "Verifying services..."

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://$EXTERNAL_IP:3000 | grep -q "200\|301\|302"; then
    print_success "Frontend is responding"
else
    print_warning "Frontend not responding yet"
fi

# Check backend
if curl -s http://$EXTERNAL_IP:8080/health | grep -q "ok"; then
    print_success "Backend is healthy"
else
    print_warning "Backend not responding yet"
fi

echo ""
echo -e "${GREEN}Update complete!${NC}"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo "  Frontend: http://$EXTERNAL_IP:3000"
echo "  Backend:  http://$EXTERNAL_IP:8080"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:    gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd /opt/incident-simulator && sudo docker compose logs -f'"
echo "  Check status: gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd /opt/incident-simulator && sudo docker compose ps'"
echo ""

