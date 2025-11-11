#!/bin/bash
set -e

echo "🚀 Starting Incident Management Simulator (Docker Compose)..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please add your API keys and run again."
    exit 1
fi

# Start all services
echo "📦 Starting all services..."
docker compose up --build -d

echo ""
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Check health
echo ""
echo "🏥 Checking service health..."
echo ""

FAILED=0

# Check Backend
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "✅ Backend:         http://localhost:8080"
else
    echo "❌ Backend:         NOT RESPONDING"
    FAILED=1
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend:        http://localhost:3000"
else
    echo "❌ Frontend:        NOT RESPONDING"
    FAILED=1
fi

# Check AI Diagnosis
if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "✅ AI Diagnosis:    http://localhost:8000"
else
    echo "❌ AI Diagnosis:    NOT RESPONDING"
    FAILED=1
fi

# Check Health Monitor
if curl -s http://localhost:8002/status > /dev/null 2>&1; then
    echo "✅ Health Monitor:  http://localhost:8002"
else
    echo "⚠️  Health Monitor:  NOT RESPONDING (check logs)"
fi

# Check Database
if docker ps | grep -q postgres; then
    echo "✅ PostgreSQL:      Running (port 5432)"
else
    echo "❌ PostgreSQL:      NOT RUNNING"
    FAILED=1
fi

# Check Mock Systems
if docker ps | grep -q redis-test; then
    echo "✅ Redis (mock):    Running (port 6380)"
else
    echo "⚠️  Redis (mock):    NOT RUNNING"
fi

if docker ps | grep -q postgres-test; then
    echo "✅ Postgres (mock): Running (port 5433)"
else
    echo "⚠️  Postgres (mock): NOT RUNNING"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo "🎉 All critical services are running!"
    echo ""
    echo "🌐 Open: http://localhost:3000"
    echo "🔑 Password: $(grep VITE_APP_PASSWORD .env | cut -d= -f2 || echo 'changeme')"
    echo ""
    echo "📝 View logs:     docker compose logs -f [service]"
    echo "📊 Check status:  docker compose ps"
    echo "🛑 Stop all:      docker compose down"
else
    echo "⚠️  Some services failed to start!"
    echo ""
    echo "📝 Check logs: docker compose logs"
    echo "🛑 Stop all:   docker compose down"
    echo "🔄 Retry:      docker compose up --build"
fi
echo ""

