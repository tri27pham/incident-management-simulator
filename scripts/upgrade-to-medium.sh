#!/bin/bash
set -e

echo "🔄 Upgrading VM to e2-medium (current original size)..."
echo ""

# Stop VM
echo "1️⃣ Stopping VM..."
gcloud compute instances stop incident-simulator --zone=us-east1-b
echo "✅ VM stopped"
echo ""

# Change machine type
echo "2️⃣ Changing to e2-medium..."
gcloud compute instances set-machine-type incident-simulator \
  --machine-type=e2-medium \
  --zone=us-east1-b
echo "✅ Machine type changed to e2-medium"
echo ""

# Start VM
echo "3️⃣ Starting VM..."
gcloud compute instances start incident-simulator --zone=us-east1-b
echo "✅ VM started"
echo ""

# Wait for startup
echo "⏳ Waiting 30 seconds for services to start..."
sleep 30

# Check status
echo "4️⃣ Checking VM status..."
gcloud compute instances describe incident-simulator --zone=us-east1-b --format="get(status,machineType)"
echo ""

echo "✅ Done! Your VM is back to e2-medium (4GB RAM)!"
echo ""
echo "🌐 Access at: http://35.231.199.112:3000"
echo "🔑 Password: incident.io"
echo ""
echo "💰 Cost: ~$24.27/month (24/7) or ~$3/month (20h/month with stop/start)"

