#!/bin/bash

# Ultra-fast Redis breaking using redis-benchmark
# Fills Redis to capacity in 2-5 seconds!

echo "⚡ Breaking Redis FAST using redis-benchmark..."
echo ""

# Check if Redis container is running
if ! docker ps | grep -q redis-test; then
    echo "❌ Redis container 'redis-test' is not running"
    exit 1
fi

# Get current memory
get_memory_percent() {
    USED=$(docker exec redis-test redis-cli INFO memory | grep '^used_memory:' | cut -d: -f2 | tr -d '\r')
    MAX=$(docker exec redis-test redis-cli INFO memory | grep '^maxmemory:' | cut -d: -f2 | tr -d '\r')
    echo $((USED * 100 / MAX))
}

CURRENT=$(get_memory_percent)
echo "📊 Current: ${CURRENT}% full"

if [ $CURRENT -gt 90 ]; then
    echo "✅ Redis already full!"
    exit 0
fi

echo ""
echo "💣 Filling Redis with large values at maximum speed..."
START=$(date +%s)

# Use redis-benchmark to fill quickly with unique keys
# -t set = only SET operations
# -r 100000 = use random keys in range (ensures unique keys)
# -n 100000 = 100,000 operations
# -d 500 = 500 bytes per value (50MB total)
# -q = quiet mode (only show summary)
docker exec redis-test redis-benchmark -t set -r 100000 -n 100000 -d 500 -q

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
FINAL=$(get_memory_percent)
echo "✅ Complete in ${ELAPSED} seconds!"
echo "📊 Redis is now ${FINAL}% full"
echo ""

# If not full enough, run one more batch
if [ $FINAL -lt 90 ]; then
    echo "🔁 Running one more batch to ensure it's full..."
    docker exec redis-test redis-benchmark -t set -r 100000 -n 50000 -d 500 -q
    FINAL=$(get_memory_percent)
    echo "📊 Redis is now ${FINAL}% full"
fi

echo ""
echo "🎯 Done! Check your frontend for incidents: http://localhost:5173"
echo "📡 Logs: ./scripts/logs.sh health"
echo ""

