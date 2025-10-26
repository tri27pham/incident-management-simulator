#!/bin/bash

# Script to fill Redis with data until it reaches memory limit
# This simulates a real incident that the health monitor should detect

echo "🔧 Breaking Redis by filling it with data..."
echo ""

# Check if Redis container is running
if ! docker ps | grep -q redis-test; then
    echo "❌ Redis container 'redis-test' is not running"
    echo "   Start it with: docker-compose up redis-test -d"
    exit 1
fi

# Get memory limits
MAX_MEMORY=$(docker exec redis-test redis-cli INFO memory | grep '^maxmemory:' | cut -d: -f2 | tr -d '\r')
MAX_MB=$((MAX_MEMORY / 1024 / 1024))

echo "📊 Redis Configuration:"
echo "   Max Memory: ${MAX_MB}MB"
echo ""

# Function to get current memory percentage
get_memory_percent() {
    USED=$(docker exec redis-test redis-cli INFO memory | grep '^used_memory:' | cut -d: -f2 | tr -d '\r')
    MAX=$(docker exec redis-test redis-cli INFO memory | grep '^maxmemory:' | cut -d: -f2 | tr -d '\r')
    PERCENT=$((USED * 100 / MAX))
    echo $PERCENT
}

# Check current memory usage
CURRENT=$(get_memory_percent)
echo "📊 Current memory usage: ${CURRENT}%"

if [ $CURRENT -gt 90 ]; then
    echo ""
    echo "✅ Redis is already ${CURRENT}% full!"
    echo "   No need to fill it more."
    echo ""
    echo "💡 To reset Redis: ./scripts/fix-redis.sh"
    exit 0
fi

echo ""
echo "💣 Filling Redis with 25KB chunks until 95% full..."
echo "   This should take 10-30 seconds depending on current usage"
echo ""

# Use Python to fill Redis efficiently
python3 << 'EOF'
import subprocess
import sys
import time

def get_memory_percent():
    result = subprocess.run(
        ["docker", "exec", "redis-test", "redis-cli", "INFO", "memory"],
        capture_output=True,
        text=True
    )
    lines = result.stdout.split('\n')
    used = max = 0
    for line in lines:
        if line.startswith('used_memory:'):
            used = int(line.split(':')[1].strip())
        elif line.startswith('maxmemory:'):
            max = int(line.split(':')[1].strip())
    
    if max == 0:
        return 0
    return int((used / max) * 100)

# Fill Redis
counter = 0
value = "X" * 25000  # 25KB per key

print("Progress: ", end='', flush=True)
start_time = time.time()

while True:
    current_percent = get_memory_percent()
    
    # Stop at 95% to avoid hanging
    if current_percent >= 95:
        print(f"\n✅ Redis is now {current_percent}% full!")
        break
    
    # Add key
    key = f"incident_data_{counter}"
    subprocess.run(
        ["docker", "exec", "redis-test", "redis-cli", "SET", key, value],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    counter += 1
    
    # Show progress every 50 keys
    if counter % 50 == 0:
        print(f"{current_percent}%...", end=' ', flush=True)
    
    # Safety check - don't run forever
    if counter > 3000:
        print(f"\n⚠️  Added {counter} keys but memory only at {current_percent}%")
        print("   This might indicate a configuration issue")
        break

elapsed = time.time() - start_time
print(f"\n⏱️  Time taken: {elapsed:.1f} seconds")
print(f"📦 Keys added: {counter}")
EOF

echo ""
echo "📊 Final Redis memory usage:"
docker exec redis-test redis-cli INFO memory | grep -E "used_memory:|maxmemory:"
echo ""

# Test that Redis is rejecting writes
echo "🧪 Testing if Redis rejects new writes (expecting OOM error):"
docker exec redis-test redis-cli SET test_key "This should fail with OOM" 2>&1 || echo "   ✅ Redis is correctly rejecting writes!"
echo ""

FINAL=$(get_memory_percent)
echo "🎯 Redis is now ${FINAL}% full!"
echo ""
echo "📡 The health monitor checks every 10 seconds and will:"
echo "   1. Detect Redis health < 70%"
echo "   2. Automatically create an incident"
echo "   3. Broadcast to your frontend via WebSocket"
echo ""
echo "💡 Watch it happen:"
echo "   - Frontend: http://localhost:5173"
echo "   - Logs:     ./scripts/logs.sh health"
echo ""
echo "🔧 To fix Redis: ./scripts/fix-redis.sh"
echo ""
