#!/bin/bash

# Fix database connections script
# Usage: ./fix-db-connections.sh
# Use this when you see "Datasource was invalidated" or connection errors

echo "🔧 Fixing Database Connections..."
echo ""

# Check if PostgreSQL is running
if ! docker ps 2>/dev/null | grep -q postgres-dev && ! lsof -ti:5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running!"
    echo "   Start it with: ./start.sh"
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Show current connections
echo "📊 Current connections:"
PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -c "SELECT pid, application_name, state, state_change FROM pg_stat_activity WHERE datname = 'incident_db';"
echo ""

# Count idle connections
IDLE_COUNT=$(PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'incident_db' AND state = 'idle' AND pid <> pg_backend_pid();" | xargs)

if [ "$IDLE_COUNT" -gt 0 ]; then
    echo "⚠️  Found $IDLE_COUNT idle connections"
    echo ""
    read -p "Kill idle connections? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🧹 Killing idle connections..."
        PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'incident_db' AND pid <> pg_backend_pid() AND state = 'idle';" > /dev/null
        echo "✅ Idle connections terminated"
        echo ""
        echo "💡 Now reconnect in DBeaver or your database client"
    else
        echo "❌ Cancelled"
    fi
else
    echo "✅ No idle connections found"
    echo ""
    echo "💡 Try reconnecting in DBeaver:"
    echo "   Right-click connection → 'Invalidate/Reconnect'"
fi

echo ""

