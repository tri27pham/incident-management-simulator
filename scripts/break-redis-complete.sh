#!/bin/bash

# Script to COMPLETELY fill Redis until it's rejecting writes
# Guaranteed to trigger health monitor

echo "💣 Filling Redis to 100% capacity..."
echo ""

# Check if Redis container is running
if ! docker ps | grep -q redis-test; then
    echo "❌ Redis container 'redis-test' is not running"
    exit 1
fi

get_memory_percent() {
    USED=$(docker exec redis-test redis-cli INFO memory | grep '^used_memory:' | cut -d: -f2 | tr -d '\r')
    MAX=$(docker exec redis-test redis-cli INFO memory | grep '^maxmemory:' | cut -d: -f2 | tr -d '\r')
    echo $((USED * 100 / MAX))
}

echo "📊 Before: $(get_memory_percent)% full"
echo ""
echo "🔥 Phase 1: Fast fill to 70%..."
docker exec redis-test redis-benchmark -t set -r 200000 -n 100000 -d 500 -q

echo "🔥 Phase 2: Fast fill to 90%..."
docker exec redis-test redis-benchmark -t set -r 400000 -n 100000 -d 500 -q

CURRENT=$(get_memory_percent)
echo ""
echo "📊 Current: ${CURRENT}% full"

# Keep adding until we hit OOM errors
if [ $CURRENT -lt 95 ]; then
    echo ""
    echo "🔥 Phase 3: Top off to 95%+..."
    docker exec redis-test redis-benchmark -t set -r 600000 -n 50000 -d 500 -q
fi

FINAL=$(get_memory_percent)
echo ""
echo "✅ Redis is now ${FINAL}% full!"
echo ""

# Calculate health (health = 100 - memory_percent)
HEALTH=$((100 - FINAL))
echo "🏥 Health Monitor will see:"
echo "   Memory: ${FINAL}%"
echo "   Health: ${HEALTH}% (threshold: 70%)"
echo ""

if [ $HEALTH -lt 70 ]; then
    echo "✅ Health < 70% - INCIDENT WILL BE CREATED!"
else
    echo "⚠️  Health still > 70% - may not trigger incident"
    echo "   Run this script again to add more data"
fi

echo ""
echo "📡 Watch for incident in:"
echo "   - Frontend: http://localhost:5173"
echo "   - Logs:     ./scripts/logs.sh health"
echo "   - Check in: 10 seconds (next health check cycle)"
echo ""

