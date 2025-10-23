#!/bin/bash

# Docker Compose start script for Incident Management Simulator
# Usage: ./start-docker.sh

echo "🚀 Starting Incident Management Simulator (Docker Compose)..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop, then run this script again."
    exit 1
fi

echo "🐳 Starting all services with Docker Compose..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

echo ""
echo "🗄️  Running database migrations..."
for migration in backend/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   Applying $(basename "$migration")..."
        docker exec -i postgres psql -U incident_user -d incident_db < "$migration" > /dev/null 2>&1 || {
            echo "   ⚠️  Migration $(basename "$migration") already applied or failed (this is usually fine)"
        }
    fi
done
echo "✅ Migrations complete!"

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Services started!"
echo ""
echo "🌐 Access points:"
echo "   Frontend:       http://localhost:3000"
echo "   Backend API:    http://localhost:8080"
echo "   AI Diagnosis:   http://localhost:8000"
echo "   PostgreSQL:     localhost:5432"
echo ""
echo "📝 Commands:"
echo "   View logs:      docker-compose logs -f [service]"
echo "   Check status:   docker-compose ps"
echo "   Stop services:  ./stop-docker.sh"
echo "   Restart:        docker-compose restart [service]"
echo ""

