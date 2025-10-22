#!/bin/bash

# Start script for Incident Management Simulator
# Usage: ./start.sh

set -e

PROJECT_DIR="/Users/tripham/Documents/Professional/incident.io/incident-management-simulator"

echo "🚀 Starting Incident Management Simulator..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop, then run this script again."
    echo ""
    echo "💡 Alternative: If you have PostgreSQL installed locally,"
    echo "   you can skip this step and the services will connect to localhost:5432"
    exit 1
fi

# Pre-flight check: Kill any existing services on required ports
echo "🧹 Checking for conflicting services..."
CONFLICTS=0

if lsof -ti:8080 > /dev/null 2>&1; then
    echo "⚠️  Port 8080 (Backend) is in use. Killing conflicting process..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    CONFLICTS=1
fi

if lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚠️  Port 5173 (Frontend) is in use. Killing conflicting process..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    CONFLICTS=1
fi

if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 (AI Diagnosis) is in use. Killing conflicting process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    CONFLICTS=1
fi

if lsof -ti:9000 > /dev/null 2>&1; then
    echo "⚠️  Port 9000 (Generator API) is in use. Killing conflicting process..."
    lsof -ti:9000 | xargs kill -9 2>/dev/null || true
    CONFLICTS=1
fi

if [ $CONFLICTS -eq 1 ]; then
    echo "✅ Conflicts resolved. Waiting for ports to be released..."
    sleep 2
fi
echo ""

# Check if postgres container exists
if docker ps -a | grep -q postgres-dev; then
    echo "📦 Starting existing PostgreSQL container..."
    docker start postgres-dev
else
    echo "📦 Creating and starting PostgreSQL container..."
    docker run -d \
        --name postgres-dev \
        -e POSTGRES_USER=incident_user \
        -e POSTGRES_PASSWORD=incident_pass \
        -e POSTGRES_DB=incident_db \
        -p 5432:5432 \
        postgres:16-alpine
fi

echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 3

# Clear any stale connections (e.g., from DBeaver)
echo "🧹 Cleaning up stale connections..."
PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'incident_db' AND pid <> pg_backend_pid() AND state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';" > /dev/null 2>&1 || true

echo "🔧 Starting Backend (Go)..."
cd "$PROJECT_DIR/backend"
AI_DIAGNOSIS_URL=http://localhost:8000 go run main.go > /tmp/incident-backend.log 2>&1 &
echo $! > /tmp/incident-backend.pid

echo "🤖 Starting AI Diagnosis (FastAPI)..."
cd "$PROJECT_DIR/ai-diagnosis"
python3 -u -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload > /tmp/incident-ai.log 2>&1 &
echo $! > /tmp/incident-ai.pid

echo "⏳ Waiting for services to start..."
sleep 3

echo "🎨 Starting Frontend (Vite)..."
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/incident-frontend.log 2>&1 &
echo $! > /tmp/incident-frontend.pid

echo "🎲 Starting Incident Generator API..."
cd "$PROJECT_DIR/incident-generator"
BACKEND_URL=http://localhost:8080 python3 -u app.py > /tmp/incident-generator.log 2>&1 &
echo $! > /tmp/incident-generator.pid

echo ""
echo "⏳ Verifying all services are healthy..."
echo ""

# Wait and verify each service
sleep 5

FAILED=0

# Check PostgreSQL
if docker ps | grep -q postgres-dev; then
    echo "✅ PostgreSQL:        Running"
else
    echo "❌ PostgreSQL:        FAILED"
    FAILED=1
fi

# Check Backend
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "✅ Backend API:       http://localhost:8080"
else
    echo "❌ Backend API:       NOT RESPONDING"
    echo "   Check logs: tail -f /tmp/incident-backend.log"
    FAILED=1
fi

# Check AI Diagnosis
if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "✅ AI Diagnosis:      http://localhost:8000"
else
    echo "❌ AI Diagnosis:      NOT RESPONDING"
    echo "   Check logs: tail -f /tmp/incident-ai.log"
    FAILED=1
fi

# Check Frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend:          http://localhost:5173"
else
    echo "❌ Frontend:          NOT RESPONDING"
    echo "   Check logs: tail -f /tmp/incident-frontend.log"
    FAILED=1
fi

# Check Generator API
if curl -s http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ Generator API:     http://localhost:9000 (stopped by default)"
else
    echo "❌ Generator API:     NOT RESPONDING"
    echo "   Check logs: tail -f /tmp/incident-generator.log"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo "🎉 All services are healthy and ready!"
    echo ""
    echo "📊 Open in browser: http://localhost:5173"
    echo "📝 View logs: ./logs.sh [service]"
    echo "📊 Check status: ./status.sh"
    echo "🛑 To stop: ./stop.sh"
else
    echo "⚠️  Some services failed to start!"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check logs: ./logs.sh"
    echo "   2. Stop all: ./stop.sh"
    echo "   3. Try again: ./start.sh"
fi
echo ""

