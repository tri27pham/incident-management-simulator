#!/bin/bash

# Start script for Incident Management Simulator (Without Docker)
# Usage: ./start-no-docker.sh
# Requires: PostgreSQL installed and running locally on port 5432

set -e

PROJECT_DIR="/Users/tripham/Documents/Professional/incident.io/incident-management-simulator"

echo "🚀 Starting Incident Management Simulator (No Docker)..."
echo ""

# Check if PostgreSQL is running locally
if ! lsof -ti:5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on port 5432!"
    echo ""
    echo "Please start PostgreSQL, or use ./start.sh with Docker."
    echo ""
    echo "To install PostgreSQL with Homebrew:"
    echo "  brew install postgresql@16"
    echo "  brew services start postgresql@16"
    exit 1
fi

echo "✅ PostgreSQL detected on port 5432"
echo ""

echo "🔧 Starting Backend (Go)..."
cd "$PROJECT_DIR/backend"
AI_DIAGNOSIS_URL=http://localhost:8000 go run main.go > /tmp/incident-backend.log 2>&1 &
echo $! > /tmp/incident-backend.pid

echo "🤖 Starting AI Diagnosis (FastAPI)..."
cd "$PROJECT_DIR/ai-diagnosis"
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload > /tmp/incident-ai.log 2>&1 &
echo $! > /tmp/incident-ai.pid

echo "⏳ Waiting for services to start..."
sleep 3

echo "🎨 Starting Frontend (Vite)..."
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/incident-frontend.log 2>&1 &
echo $! > /tmp/incident-frontend.pid

echo "🎲 Starting Incident Generator..."
cd "$PROJECT_DIR/incident-generator"
BACKEND_URL=http://localhost:8080 python3 app.py > /tmp/incident-generator.log 2>&1 &
echo $! > /tmp/incident-generator.pid

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Services:"
echo "   🌐 Frontend:     http://localhost:5173"
echo "   🔧 Backend API:  http://localhost:8080"
echo "   🤖 AI Diagnosis: http://localhost:8000"
echo "   📦 PostgreSQL:   localhost:5432 (local)"
echo ""
echo "📝 Logs are in /tmp/incident-*.log"
echo "🛑 To stop: ./stop.sh"
echo ""

