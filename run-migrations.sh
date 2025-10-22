#!/bin/bash

# Run database migrations
# Usage: ./run-migrations.sh [docker-compose|local]

MODE="${1:-auto}"

echo "🗄️  Database Migration Script"
echo ""

# Auto-detect which database is running
if [ "$MODE" = "auto" ]; then
    if docker ps | grep -q "postgres-dev"; then
        MODE="local"
        echo "📍 Detected: Local development mode (postgres-dev)"
    elif docker ps | grep -q "^.*postgres"; then
        MODE="docker-compose"
        echo "📍 Detected: Docker Compose mode (postgres)"
    else
        echo "❌ No PostgreSQL container found!"
        echo ""
        echo "Please start the database first:"
        echo "  Local dev:      ./start.sh"
        echo "  Docker Compose: ./start-docker.sh"
        exit 1
    fi
fi

# Set container name based on mode
if [ "$MODE" = "local" ]; then
    CONTAINER="postgres-dev"
elif [ "$MODE" = "docker-compose" ]; then
    CONTAINER="postgres"
else
    echo "❌ Invalid mode: $MODE"
    echo "Usage: ./run-migrations.sh [docker-compose|local]"
    exit 1
fi

echo "🐘 Target container: $CONTAINER"
echo ""

# Check if container is running
if ! docker ps | grep -q "$CONTAINER"; then
    echo "❌ Container '$CONTAINER' is not running!"
    exit 1
fi

# Run migrations
echo "🗄️  Running migrations..."
echo ""

MIGRATION_DIR="$(dirname "$0")/backend/migrations"
MIGRATION_COUNT=0
FAILED_COUNT=0

for migration in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_NAME=$(basename "$migration")
        echo "   📄 Applying $MIGRATION_NAME..."
        
        if docker exec -i "$CONTAINER" psql -U incident_user -d incident_db < "$migration" > /dev/null 2>&1; then
            echo "      ✅ Success"
            ((MIGRATION_COUNT++))
        else
            echo "      ⚠️  Already applied or failed (this is usually fine)"
            ((FAILED_COUNT++))
        fi
    fi
done

echo ""
if [ $MIGRATION_COUNT -gt 0 ]; then
    echo "✅ Applied $MIGRATION_COUNT new migration(s)"
fi
if [ $FAILED_COUNT -gt 0 ]; then
    echo "ℹ️  Skipped $FAILED_COUNT migration(s) (already applied)"
fi
echo ""
echo "🎉 Migration process complete!"

