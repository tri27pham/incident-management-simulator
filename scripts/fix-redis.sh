#!/bin/bash

# Script to fix Redis by clearing all data
# This simulates what the AI agent will do automatically

echo "🔧 Fixing Redis by clearing all data..."
echo ""

# Check if Redis container is running
if ! docker ps | grep -q redis-test; then
    echo "❌ Redis container 'redis-test' is not running"
    echo "   Start it with: docker-compose up redis-test -d"
    exit 1
fi

# Check current memory usage
echo "📊 Redis memory BEFORE fix:"
docker exec redis-test redis-cli INFO memory | grep -E "used_memory:|maxmemory:"
echo ""

# Clear all data
echo "💊 Executing fix: FLUSHALL"
docker exec redis-test redis-cli FLUSHALL
echo ""

# Check memory usage after fix
echo "📊 Redis memory AFTER fix:"
docker exec redis-test redis-cli INFO memory | grep -E "used_memory:|maxmemory:"
echo ""

# Test that Redis is working
echo "🧪 Testing Redis (should succeed):"
docker exec redis-test redis-cli SET test_key "Redis is working!"
docker exec redis-test redis-cli GET test_key
echo ""

echo "✅ Redis fixed! Memory should be ~2-5% now"
echo "   Health monitor should detect the recovery"

