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
    
    # Terminate all connections to the database
    echo "🔌 Terminating active connections..."
    docker exec -i "$CONTAINER_NAME" psql -U $DB_USER -d postgres -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
    " 2>/dev/null
    
    # Drop and recreate the database
    echo "🗑️  Dropping database via Docker..."
    docker exec -i "$CONTAINER_NAME" psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    
    echo "📦 Creating fresh database via Docker..."
    docker exec -i "$CONTAINER_NAME" psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
    
    echo "✅ Database reset complete!"
else
    echo "🗑️  Dropping database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    
    echo "📦 Creating fresh database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
    
    echo "✅ Database reset complete!"
fi

echo ""
echo "🗄️  Running database migrations..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run migrations
MIGRATION_COUNT=0
if [ "$USING_DOCKER" = true ]; then
    for migration in "$SCRIPT_DIR"/../backend/migrations/*.sql; do
        if [ -f "$migration" ]; then
            MIGRATION_NAME=$(basename "$migration")
            echo "   📄 Applying $MIGRATION_NAME..."
            if docker exec -i "$CONTAINER_NAME" psql -U $DB_USER -d $DB_NAME < "$migration" > /dev/null 2>&1; then
                ((MIGRATION_COUNT++))
            else
                echo "      ⚠️  Warning: Migration may have already been applied"
            fi
        fi
    done
else
    for migration in "$SCRIPT_DIR"/../backend/migrations/*.sql; do
        if [ -f "$migration" ]; then
            MIGRATION_NAME=$(basename "$migration")
            echo "   📄 Applying $MIGRATION_NAME..."
            if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < "$migration" > /dev/null 2>&1; then
                ((MIGRATION_COUNT++))
            else
                echo "      ⚠️  Warning: Migration may have already been applied"
            fi
        fi
    done
fi

echo ""
echo "✅ Database reset and migrations complete!"
echo ""
echo "💡 The database is ready with a fresh schema."
echo "💡 You can now use the system normally."
echo ""

