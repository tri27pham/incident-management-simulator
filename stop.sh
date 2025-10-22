#!/bin/bash

# Stop script for Incident Management Simulator
# Usage: ./stop.sh

echo "🛑 Stopping Incident Management Simulator..."
echo ""

# Kill processes by PID files first
if [ -f /tmp/incident-backend.pid ]; then
    echo "🔧 Stopping Backend (PID)..."
    kill -9 $(cat /tmp/incident-backend.pid) 2>/dev/null || true
    rm /tmp/incident-backend.pid
fi

if [ -f /tmp/incident-ai.pid ]; then
    echo "🤖 Stopping AI Diagnosis (PID)..."
    kill -9 $(cat /tmp/incident-ai.pid) 2>/dev/null || true
    rm /tmp/incident-ai.pid
fi

if [ -f /tmp/incident-frontend.pid ]; then
    echo "🎨 Stopping Frontend (PID)..."
    kill -9 $(cat /tmp/incident-frontend.pid) 2>/dev/null || true
    rm /tmp/incident-frontend.pid
fi

if [ -f /tmp/incident-generator.pid ]; then
    echo "🎲 Stopping Generator API (PID)..."
    kill -9 $(cat /tmp/incident-generator.pid) 2>/dev/null || true
    rm /tmp/incident-generator.pid
fi

# Aggressive cleanup: Kill by port (catches orphaned processes)
echo "🧹 Cleaning up processes by port..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true  # Backend
lsof -ti:5173 | xargs kill -9 2>/dev/null || true  # Frontend
lsof -ti:8000 | xargs kill -9 2>/dev/null || true  # AI Diagnosis
lsof -ti:9000 | xargs kill -9 2>/dev/null || true  # Generator API

# Kill by process pattern (final fallback)
echo "🧹 Cleaning up processes by name..."
pkill -9 -f "go run main.go" 2>/dev/null || true
pkill -9 -f "uvicorn app:app" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "incident-generator/app.py" 2>/dev/null || true

# Clean up any stale log files
rm -f /tmp/incident-backend-new.log 2>/dev/null || true
rm -f /tmp/incident-ai-new.log 2>/dev/null || true

sleep 1

# Stop PostgreSQL (if running in Docker)
if docker ps 2>/dev/null | grep -q postgres-dev; then
    echo "📦 Stopping PostgreSQL (Docker)..."
    docker stop postgres-dev 2>/dev/null || true
else
    echo "📦 PostgreSQL (running locally or already stopped)"
fi

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 To start again: ./start.sh or ./start-no-docker.sh"
echo "🗑️  To remove Docker database: docker rm postgres-dev"
echo "📝 View logs: tail -f /tmp/incident-*.log"
echo ""

