#!/bin/bash

# Docker Compose stop script for Incident Management Simulator
# Usage: ./stop-docker.sh

echo "🛑 Stopping Incident Management Simulator (Docker Compose)..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running! Services may already be stopped."
    exit 0
fi

echo "🐳 Stopping all services..."
docker-compose down

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 Commands:"
echo "   Start again:    ./start-docker.sh"
echo "   Remove volumes: docker-compose down -v"
echo "   View logs:      docker-compose logs [service]"
echo ""

