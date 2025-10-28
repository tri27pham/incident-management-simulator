#!/bin/bash

# Reset Database script for Incident Management Simulator
# Usage: ./reset-db.sh
# This script drops and recreates the entire database (nuclear option)

echo "💣 Resetting Incident Database (NUCLEAR OPTION)..."
echo ""

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="incident_user"
DB_PASSWORD="incident_pass"
DB_NAME="incident_db"

# Check if we're using Docker or local PostgreSQL
if docker ps 2>/dev/null | grep -q "postgres-dev"; then
    echo "📦 Detected PostgreSQL in Docker (postgres-dev)"
    USING_DOCKER=true
    CONTAINER_NAME="postgres-dev"
elif docker ps 2>/dev/null | grep -qE "^[a-f0-9]+.*postgres"; then
    echo "📦 Detected PostgreSQL in Docker Compose (postgres)"
    USING_DOCKER=true
    CONTAINER_NAME="postgres"
else
    echo "🏠 Assuming local PostgreSQL"
    USING_DOCKER=false
    CONTAINER_NAME=""
fi

echo ""
echo "⚠️  WARNING: This will completely destroy and recreate the database!"
echo "⚠️  All data, tables, and schema will be lost!"
echo ""
read -p "Are you sure you want to continue? (yes/NO): " -r
echo ""

if [[ ! $REPLY == "yes" ]]; then
    echo "❌ Cancelled. Database was not reset."
    exit 0
fi

if [ "$USING_DOCKER" = true ]; then
    echo "🔄 Resetting Docker container: $CONTAINER_NAME..."
    
    # Clear all mock services FIRST to restore healthy state
    echo "🧹 Restoring all mock services to healthy state..."
    
    # Clear Redis
    echo "  • Clearing Redis memory..."
    curl -X POST http://localhost:8002/clear/redis -s > /dev/null 2>&1 || echo "    ⚠️  Could not clear Redis"
    
    # Clear PostgreSQL connections
    echo "  • Clearing PostgreSQL connections..."
    curl -X POST http://localhost:8002/clear/postgres -s > /dev/null 2>&1 || echo "    ⚠️  Could not clear PostgreSQL"
    
    # Clear PostgreSQL bloat
    echo "  • Clearing PostgreSQL bloat..."
    curl -X POST http://localhost:8002/clear/postgres-bloat -s > /dev/null 2>&1 || echo "    ⚠️  Could not clear PostgreSQL bloat"
    
    # Clear disk space
    echo "  • Clearing disk space..."
    curl -X POST http://localhost:8002/clear/disk -s > /dev/null 2>&1 || echo "    ⚠️  Could not clear disk space"
    
    echo "   ✓ All mock services restored to healthy state"
    sleep 1
    
    # Stop ALL services to release database connections and prevent auto-creation
    echo "🛑 Stopping all service containers..."
    docker-compose stop backend health-monitor ai-diagnosis 2>/dev/null || true
    sleep 3
    
    # Truncate all tables to delete all data
    echo "🗑️  Truncating all tables..."
    TRUNCATE_OUTPUT=$(docker exec -i "$CONTAINER_NAME" psql -U $DB_USER -d $DB_NAME <<-EOSQL 2>&1
        -- Truncate all tables with CASCADE to handle foreign key constraints
        TRUNCATE TABLE incidents, incident_analysis, incident_status_history, agent_executions RESTART IDENTITY CASCADE;
EOSQL
    )
    
    if echo "$TRUNCATE_OUTPUT" | grep -q "TRUNCATE TABLE"; then
        echo "   ✓ All tables truncated successfully"
    else
        echo "   ⚠️  Output: $TRUNCATE_OUTPUT"
    fi
    
    echo "✅ Database cleared!"
else
    echo "🗑️  Truncating all tables..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE incidents, incident_analysis, incident_status_history, agent_executions RESTART IDENTITY CASCADE;" 2>/dev/null
    echo "✅ Database cleared!"
fi

echo ""

# Restart all services that were stopped
if [ "$USING_DOCKER" = true ]; then
    echo "🔄 Restarting all service containers..."
    docker-compose start backend health-monitor ai-diagnosis 2>/dev/null || true
    sleep 3
    echo "   ✓ Services restarted"
    
    # Broadcast reset to connected clients
    echo "📡 Broadcasting reset to connected frontends..."
    sleep 1  # Give backend a moment to fully start
    curl -X POST http://localhost:8080/api/v1/reset -s > /dev/null 2>&1 || echo "   ⚠️  Could not broadcast (backend may still be starting)"
    echo "   ✓ Reset broadcast sent"
fi

echo ""
echo "💡 All data has been cleared from all tables."
echo "💡 All connected frontends have been notified to clear their cache."
echo ""

