#!/bin/bash

# Check VM status and restart services if needed

set -e

ZONE="us-east1-b"
VM_NAME="incident-simulator"

echo "🔍 Checking VM and Docker status..."
echo ""

# Check if VM is running
VM_STATUS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(status)')
echo "VM Status: $VM_STATUS"

if [ "$VM_STATUS" != "RUNNING" ]; then
    echo "❌ VM is not running!"
    echo "Starting VM..."
    gcloud compute instances start $VM_NAME --zone=$ZONE
    echo "⏳ Waiting for VM to start..."
    sleep 30
fi

echo ""
echo "🐳 Checking Docker containers..."
echo ""

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
    cd /opt/incident-simulator
    echo '=== Docker Compose Status ==='
    sudo docker compose ps
    echo ''
    echo '=== Recent Backend Logs ==='
    sudo docker compose logs backend --tail=20
"

echo ""
echo "🔄 Restarting Docker containers..."
echo ""

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
    cd /opt/incident-simulator
    sudo docker compose down
    sudo docker compose up -d --build
    echo '✅ Containers restarted'
    echo ''
    echo 'Waiting 15 seconds for services to start...'
    sleep 15
    sudo docker compose ps
"

echo ""
echo "🧪 Testing API..."
VM_IP=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

sleep 5
curl -s http://$VM_IP:8080/api/v1/health && echo "" && echo "✅ Backend API is working!" || echo "❌ Backend still not responding"

echo ""
echo "🌐 Access your app at: http://$VM_IP:3000"

