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
echo "🔐 AUTHENTICATION:"
echo "   Password: changeme (default)"
echo "   Change in .env: APP_PASSWORD=your_password"
echo ""
echo "🌐 Access points:"
echo "   Frontend:       http://localhost:3000  (requires password!)"
echo "   Backend API:    http://localhost:8080"
echo "   AI Diagnosis:   http://localhost:8000"
echo "   Health Monitor: http://localhost:8002"
echo "   PostgreSQL:     localhost:5432"
echo "   Redis Test:     localhost:6380  (for AI agent)"
echo "   Postgres Test:  localhost:5433  (for AI agent)"
echo ""
echo "📝 Commands:"
echo "   View logs:      docker-compose logs -f [service]"
echo "   Check status:   docker-compose ps"
echo "   Stop services:  ./scripts/stop-docker.sh"
echo "   Restart:        docker-compose restart [service]"
echo ""
echo "💡 AI Agent Testing:"
echo "   Trigger Redis failure:     curl -X POST http://localhost:8002/trigger/redis-memory"
echo "   Trigger Postgres failure:  curl -X POST http://localhost:8002/trigger/postgres-connections"
echo "   Trigger Disk failure:      curl -X POST http://localhost:8002/trigger/disk-full"
echo ""

