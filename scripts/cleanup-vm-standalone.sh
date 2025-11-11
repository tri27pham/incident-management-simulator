#!/bin/bash

#############################################################################
# Cleanup GCP Resources for Incident Management Simulator
# 
# This script deletes:
# - VM instance
# - Firewall rules
# - Backup bucket (optional)
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
BUCKET_NAME="${PROJECT_ID}-incident-backups"

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

echo ""
echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                ║${NC}"
echo -e "${RED}║           CLEANUP WARNING                      ║${NC}"
echo -e "${RED}║                                                ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will DELETE the following resources:${NC}"
echo ""
echo "  • VM Instance: $VM_NAME"
echo "  • Firewall Rules: allow-incident-frontend, allow-incident-backend"
echo "  • Backup Bucket: gs://$BUCKET_NAME (optional)"
echo ""
echo -e "${RED}WARNING: This action cannot be undone!${NC}"
echo -e "${YELLOW}Database data will be permanently lost!${NC}"
echo ""
read -p "Are you ABSOLUTELY sure? Type 'DELETE' to confirm: " confirmation

if [ "$confirmation" != "DELETE" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""

#############################################################################
# Check what exists
#############################################################################

echo "Checking existing resources..."
echo ""

VM_EXISTS=false
FIREWALL_FRONTEND_EXISTS=false
FIREWALL_BACKEND_EXISTS=false
BUCKET_EXISTS=false

if gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    VM_EXISTS=true
    echo "  ✓ VM found: $VM_NAME"
fi

if gcloud compute firewall-rules describe allow-incident-frontend &>/dev/null; then
    FIREWALL_FRONTEND_EXISTS=true
    echo "  ✓ Firewall rule found: allow-incident-frontend"
fi

if gcloud compute firewall-rules describe allow-incident-backend &>/dev/null; then
    FIREWALL_BACKEND_EXISTS=true
    echo "  ✓ Firewall rule found: allow-incident-backend"
fi

if gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
    BUCKET_EXISTS=true
    echo "  ✓ Backup bucket found: gs://$BUCKET_NAME"
fi

echo ""

if [ "$VM_EXISTS" = false ] && [ "$FIREWALL_FRONTEND_EXISTS" = false ] && [ "$FIREWALL_BACKEND_EXISTS" = false ] && [ "$BUCKET_EXISTS" = false ]; then
    print_warning "No resources found to clean up."
    exit 0
fi

#############################################################################
# Delete VM
#############################################################################

if [ "$VM_EXISTS" = true ]; then
    echo "Deleting VM instance..."
    gcloud compute instances delete $VM_NAME \
        --zone=$ZONE \
        --quiet
    print_success "VM deleted"
else
    print_warning "VM not found (already deleted)"
fi

#############################################################################
# Delete Firewall Rules
#############################################################################

if [ "$FIREWALL_FRONTEND_EXISTS" = true ]; then
    echo "Deleting frontend firewall rule..."
    gcloud compute firewall-rules delete allow-incident-frontend --quiet
    print_success "Frontend firewall rule deleted"
else
    print_warning "Frontend firewall rule not found"
fi

if [ "$FIREWALL_BACKEND_EXISTS" = true ]; then
    echo "Deleting backend firewall rule..."
    gcloud compute firewall-rules delete allow-incident-backend --quiet
    print_success "Backend firewall rule deleted"
else
    print_warning "Backend firewall rule not found"
fi

#############################################################################
# Delete Backup Bucket (optional)
#############################################################################

if [ "$BUCKET_EXISTS" = true ]; then
    echo ""
    echo -e "${YELLOW}Backup bucket found: gs://$BUCKET_NAME${NC}"
    read -p "Delete backup bucket and all backups? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting backup bucket..."
        gsutil -m rm -r gs://$BUCKET_NAME
        print_success "Backup bucket deleted"
    else
        print_warning "Backup bucket kept: gs://$BUCKET_NAME"
        echo "  To delete later: gsutil -m rm -r gs://$BUCKET_NAME"
    fi
fi

#############################################################################
# Verify cleanup
#############################################################################

echo ""
echo "Verifying cleanup..."
sleep 3

ALL_CLEAN=true

if gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    print_error "VM still exists"
    ALL_CLEAN=false
else
    print_success "VM deleted"
fi

if gcloud compute firewall-rules describe allow-incident-frontend &>/dev/null; then
    print_error "Frontend firewall rule still exists"
    ALL_CLEAN=false
else
    print_success "Frontend firewall rule deleted"
fi

if gcloud compute firewall-rules describe allow-incident-backend &>/dev/null; then
    print_error "Backend firewall rule still exists"
    ALL_CLEAN=false
else
    print_success "Backend firewall rule deleted"
fi

echo ""

if [ "$ALL_CLEAN" = true ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                ║${NC}"
    echo -e "${GREEN}║        Cleanup Complete! ✓                     ║${NC}"
    echo -e "${GREEN}║                                                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "All resources have been deleted."
    echo ""
    if [ "$BUCKET_EXISTS" = true ] && [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Backup bucket still exists:${NC} gs://$BUCKET_NAME"
        echo "  To delete: gsutil -m rm -r gs://$BUCKET_NAME"
        echo ""
    fi
    echo "To redeploy: ./scripts/deploy-vm-standalone.sh"
else
    print_error "Some resources were not deleted. Check output above."
    exit 1
fi

