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

# Stop Docker services
echo "📦 Stopping Docker services..."

if docker ps 2>/dev/null | grep -q postgres-dev; then
    docker stop postgres-dev 2>/dev/null || true
    echo "   ✓ PostgreSQL stopped"
else
    echo "   • PostgreSQL (running locally or already stopped)"
fi

if docker ps 2>/dev/null | grep -q redis-test; then
    docker stop redis-test 2>/dev/null || true
    echo "   ✓ Redis test stopped"
fi

if docker ps 2>/dev/null | grep -q postgres-test; then
    docker stop postgres-test 2>/dev/null || true
    echo "   ✓ Postgres test stopped"
fi

if docker ps 2>/dev/null | grep -q health-monitor; then
    docker stop health-monitor health-monitor-standalone 2>/dev/null || true
    docker rm health-monitor health-monitor-standalone 2>/dev/null || true
    echo "   ✓ Health monitor stopped"
fi

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 To start again:"
echo "   ./scripts/start.sh                  (recommended)"
echo "   ./scripts/start-no-docker.sh        (local dev, no Docker services)"
echo ""
echo "🔧 Useful commands:"
echo "   🗑️  Remove Docker containers:      docker rm postgres-dev redis-test health-monitor"
echo "   📝 View logs:                      tail -f /tmp/incident-*.log"
echo "   🔍 Check running processes:        ./scripts/status.sh"
echo ""

