#!/bin/bash

# Clear Database script for Incident Management Simulator
# Usage: ./clear-db.sh

echo "🗑️  Clearing Incident Database..."
echo ""

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="incident_user"
DB_PASSWORD="incident_pass"
DB_NAME="incident_db"

# Check if PostgreSQL is accessible
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo "❌ Cannot connect to PostgreSQL database!"
    echo ""
    echo "Make sure PostgreSQL is running:"
    echo "  • Docker: ./start.sh (or start Docker Desktop first)"
    echo "  • Local:  brew services start postgresql@16"
    exit 1
fi

echo "✅ Connected to database"
echo ""

# Show current incident count
INCIDENT_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM incidents;" 2>/dev/null | xargs)
echo "📊 Current incidents: $INCIDENT_COUNT"
echo ""

# Confirm deletion
read -p "⚠️  Delete all $INCIDENT_COUNT incidents? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled. No data was deleted."
    exit 0
fi

echo ""
echo "🧹 Deleting all incidents and analyses..."

# Truncate tables
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "TRUNCATE incidents, incident_analysis RESTART IDENTITY CASCADE;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database cleared successfully!"
    echo ""
    echo "💡 The database is now empty and ready for new incidents."
else
    echo "❌ Failed to clear database!"
    exit 1
fi

echo ""

