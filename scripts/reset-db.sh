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
if docker ps 2>/dev/null | grep -q postgres-dev; then
    echo "📦 Detected PostgreSQL in Docker"
    USING_DOCKER=true
else
    echo "🏠 Assuming local PostgreSQL"
    USING_DOCKER=false
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
    echo "🔄 Stopping and removing Docker container..."
    docker stop postgres-dev 2>/dev/null
    docker rm postgres-dev 2>/dev/null
    
    echo "📦 Creating fresh PostgreSQL container..."
    docker run -d \
        --name postgres-dev \
        -e POSTGRES_USER=incident_user \
        -e POSTGRES_PASSWORD=incident_pass \
        -e POSTGRES_DB=incident_db \
        -p 5432:5432 \
        postgres:16-alpine
    
    echo "⏳ Waiting for PostgreSQL to initialize..."
    sleep 5
    
    echo "✅ Database reset complete!"
else
    echo "🗑️  Dropping database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    
    echo "📦 Creating fresh database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
    
    echo "✅ Database reset complete!"
fi

echo ""
echo "💡 The database is now fresh and empty."
echo "💡 Run ./start.sh or ./start-no-docker.sh to start the services."
echo "💡 The backend will automatically create the schema on startup."
echo ""

