#!/bin/bash

#############################################################################
# Setup Automated Backups for PostgreSQL on VM
# 
# This script:
# - Creates a Cloud Storage bucket for backups
# - Sets up daily backup cron job on VM
# - Configures 7-day retention
# - Provides restore script
# 
# Cost: FREE (within 5GB Cloud Storage free tier)
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
BACKUP_RETENTION_DAYS=7

# Print section header
print_section() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

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
print_section "Pre-Flight Checks"

if [ -z "$PROJECT_ID" ]; then
    print_error "No GCP project selected"
    exit 1
fi
print_success "Project: $PROJECT_ID"

# Check if VM exists
if ! gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    print_error "VM '$VM_NAME' not found. Deploy it first with ./scripts/deploy-vm-standalone.sh"
    exit 1
fi
print_success "VM found: $VM_NAME"

#############################################################################
# Create Cloud Storage bucket
#############################################################################
print_section "Creating Backup Storage"

# Check if bucket exists
if gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
    print_success "Backup bucket already exists: gs://$BUCKET_NAME"
else
    echo "Creating Cloud Storage bucket..."
    gsutil mb -p $PROJECT_ID -l us-east1 gs://$BUCKET_NAME
    
    # Set lifecycle policy (delete backups older than 7 days)
    cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": $BACKUP_RETENTION_DAYS
        }
      }
    ]
  }
}
EOF
    
    gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME
    rm /tmp/lifecycle.json
    
    print_success "Backup bucket created: gs://$BUCKET_NAME"
fi

#############################################################################
# Grant VM access to Cloud Storage
#############################################################################
print_section "Configuring Permissions"

echo "Granting VM access to Cloud Storage..."

# Get VM service account
VM_SERVICE_ACCOUNT=$(gcloud compute instances describe $VM_NAME \
    --zone=$ZONE \
    --format='get(serviceAccounts[0].email)')

if [ -z "$VM_SERVICE_ACCOUNT" ]; then
    print_warning "Using default compute service account"
    VM_SERVICE_ACCOUNT="$(gcloud projects describe $PROJECT_ID --format='get(projectNumber)')-compute@developer.gserviceaccount.com"
fi

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$VM_SERVICE_ACCOUNT" \
    --role="roles/storage.objectAdmin" \
    --condition=None \
    &>/dev/null || print_warning "Permission might already be granted"

print_success "VM has access to Cloud Storage"

#############################################################################
# Create backup script on VM
#############################################################################
print_section "Setting Up Backup Script"

echo "Creating backup script on VM..."

gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
set -e

# Create backup script
sudo tee /usr/local/bin/backup-postgres.sh > /dev/null <<'SCRIPT'
#!/bin/bash

# Configuration
BUCKET_NAME=\"$BUCKET_NAME\"
BACKUP_DIR=\"/tmp/postgres-backups\"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE=\"postgres_backup_\${TIMESTAMP}.sql.gz\"

# Create backup directory
mkdir -p \$BACKUP_DIR

# Generate backup
echo \"[\$(date)] Starting PostgreSQL backup...\"

# Run pg_dump inside the postgres container
docker exec postgres pg_dumpall -U incidentuser | gzip > \$BACKUP_DIR/\$BACKUP_FILE

if [ \$? -eq 0 ]; then
    echo \"[\$(date)] Backup created: \$BACKUP_FILE\"
    
    # Upload to Cloud Storage
    gsutil cp \$BACKUP_DIR/\$BACKUP_FILE gs://\$BUCKET_NAME/
    
    if [ \$? -eq 0 ]; then
        echo \"[\$(date)] Backup uploaded to gs://\$BUCKET_NAME/\$BACKUP_FILE\"
        
        # Clean up local backup
        rm \$BACKUP_DIR/\$BACKUP_FILE
        echo \"[\$(date)] Local backup cleaned up\"
        echo \"[\$(date)] Backup complete!\"
    else
        echo \"[\$(date)] ERROR: Failed to upload backup\" >&2
        exit 1
    fi
else
    echo \"[\$(date)] ERROR: Failed to create backup\" >&2
    exit 1
fi
SCRIPT

# Make executable
sudo chmod +x /usr/local/bin/backup-postgres.sh

echo '✓ Backup script created'

# Create restore script
sudo tee /usr/local/bin/restore-postgres.sh > /dev/null <<'SCRIPT'
#!/bin/bash

# Configuration
BUCKET_NAME=\"$BUCKET_NAME\"

# Check if backup file specified
if [ -z \"\$1\" ]; then
    echo \"Usage: restore-postgres.sh <backup_filename>\"
    echo \"\"
    echo \"Available backups:\"
    gsutil ls gs://\$BUCKET_NAME/
    exit 1
fi

BACKUP_FILE=\"\$1\"

echo \"Restoring from \$BACKUP_FILE...\"

# Download backup
echo \"Downloading backup...\"
gsutil cp gs://\$BUCKET_NAME/\$BACKUP_FILE /tmp/restore.sql.gz

# Stop application containers (keep postgres running)
cd /opt/incident-simulator
sudo docker compose stop backend frontend ai-diagnosis health-monitor incident-generator

# Restore database
echo \"Restoring database...\"
gunzip < /tmp/restore.sql.gz | docker exec -i postgres psql -U incidentuser

# Restart application
echo \"Restarting application...\"
sudo docker compose start

# Clean up
rm /tmp/restore.sql.gz

echo \"Restore complete!\"
SCRIPT

# Make executable
sudo chmod +x /usr/local/bin/restore-postgres.sh

echo '✓ Restore script created'
"

print_success "Backup scripts installed"

#############################################################################
# Set up cron job
#############################################################################
print_section "Setting Up Daily Backups"

echo "Configuring daily backup at 2 AM..."

gcloud compute ssh $VM_NAME --zone=$ZONE --quiet --command="
# Add cron job (runs daily at 2 AM)
(crontab -l 2>/dev/null | grep -v backup-postgres.sh; echo '0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1') | crontab -

echo '✓ Cron job configured'

# Create log file
sudo touch /var/log/postgres-backup.log
sudo chmod 666 /var/log/postgres-backup.log

# Run first backup now
echo 'Running initial backup...'
/usr/local/bin/backup-postgres.sh
"

print_success "Daily backups configured (runs at 2 AM)"

#############################################################################
# Display results
#############################################################################
print_section "Backup Setup Complete!"

echo -e "${GREEN}PostgreSQL backups are now automated!${NC}"
echo ""
echo -e "${YELLOW}Backup Details:${NC}"
echo "  Bucket:       gs://$BUCKET_NAME"
echo "  Schedule:     Daily at 2:00 AM (server time)"
echo "  Retention:    $BACKUP_RETENTION_DAYS days"
echo "  Location:     us-east1"
echo "  Cost:         FREE (within 5GB free tier)"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  # Run backup now"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE --command='sudo /usr/local/bin/backup-postgres.sh'"
echo ""
echo "  # List backups"
echo "  gsutil ls gs://$BUCKET_NAME/"
echo ""
echo "  # Restore from backup"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE --command='sudo /usr/local/bin/restore-postgres.sh postgres_backup_YYYYMMDD_HHMMSS.sql.gz'"
echo ""
echo "  # View backup logs"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE --command='tail -f /var/log/postgres-backup.log'"
echo ""
echo "  # Download backup to local machine"
echo "  gsutil cp gs://$BUCKET_NAME/postgres_backup_YYYYMMDD_HHMMSS.sql.gz ."
echo ""
echo -e "${YELLOW}Backup Schedule:${NC}"
echo "  Next backup: Tomorrow at 2:00 AM"
echo "  Manual backup: Use command above"
echo ""
print_success "Setup successful! 🎉"

