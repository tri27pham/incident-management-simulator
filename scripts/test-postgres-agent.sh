#!/bin/bash

set -e

echo "🧪 Testing PostgreSQL AI Agent Remediation"
echo "=========================================="
echo ""

# Check if services are running
echo "📋 Step 1: Checking services..."
if ! docker ps | grep -q "postgres-test"; then
    echo "❌ postgres-test container is not running!"
    echo "   Run: docker-compose up -d"
    exit 1
fi

if ! curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo "❌ Backend is not responding!"
    echo "   Run: docker-compose up -d backend"
    exit 1
fi

if ! curl -s http://localhost:8002/health > /dev/null; then
    echo "❌ Health monitor is not responding!"
    echo "   Run: docker-compose up -d health-monitor"
    exit 1
fi

echo "✅ All services are running"
echo ""

# Check initial PostgreSQL health
echo "📊 Step 2: Checking initial PostgreSQL health..."
INITIAL_HEALTH=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].health')
INITIAL_IDLE=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].idle_connections')
echo "   Health: ${INITIAL_HEALTH}%"
echo "   Idle connections: ${INITIAL_IDLE}"
echo ""

# Trigger PostgreSQL connection exhaustion
echo "🔥 Step 3: Triggering PostgreSQL connection exhaustion..."
curl -s -X POST http://localhost:8002/trigger/postgres-connections | jq '.'
echo ""

# Wait for health to degrade
echo "⏳ Step 4: Waiting for health degradation (5 seconds)..."
sleep 5

DEGRADED_HEALTH=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].health')
DEGRADED_IDLE=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].idle_connections')
echo "   Health: ${DEGRADED_HEALTH}%"
echo "   Idle connections: ${DEGRADED_IDLE}"

if [ "$DEGRADED_HEALTH" -ge 70 ]; then
    echo "⚠️  Health did not degrade enough to trigger incident"
    echo "   Current health: ${DEGRADED_HEALTH}% (needs to be < 70%)"
    exit 1
fi
echo "✅ Health degraded successfully"
echo ""

# Check if incident was created
echo "🔍 Step 5: Checking for incident..."
sleep 2
INCIDENT_COUNT=$(curl -s http://localhost:8080/api/v1/incidents | jq 'length')
if [ "$INCIDENT_COUNT" -eq 0 ]; then
    echo "❌ No incident was created!"
    echo "   Health monitor may not have run yet. Wait a few more seconds."
    exit 1
fi

INCIDENT_ID=$(curl -s http://localhost:8080/api/v1/incidents | jq -r '.[0].id')
INCIDENT_MSG=$(curl -s http://localhost:8080/api/v1/incidents | jq -r '.[0].message')
echo "✅ Incident created!"
echo "   ID: ${INCIDENT_ID}"
echo "   Message: ${INCIDENT_MSG}"
echo ""

# Start AI agent remediation
echo "🤖 Step 6: Starting AI agent remediation..."
EXECUTION=$(curl -s -X POST http://localhost:8080/api/v1/incidents/${INCIDENT_ID}/agent/remediate)
EXECUTION_ID=$(echo $EXECUTION | jq -r '.id')
echo "   Execution ID: ${EXECUTION_ID}"
echo ""

# Monitor thinking phase
echo "🧠 Step 7: Monitoring AI thinking phase..."
for i in {1..30}; do
    STATUS=$(curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq -r '.status')
    echo "   Status: ${STATUS}"
    
    if [ "$STATUS" = "awaiting_approval" ]; then
        echo "✅ AI completed analysis"
        break
    fi
    
    if [ "$STATUS" = "failed" ]; then
        echo "❌ AI agent failed during thinking"
        curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq '.'
        exit 1
    fi
    
    if [ $i -eq 30 ]; then
        echo "⏰ Timeout waiting for AI analysis"
        exit 1
    fi
    
    sleep 1
done
echo ""

# Get AI recommendation
echo "📋 Step 8: AI recommendation..."
RECOMMENDATION=$(curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq -r '.recommended_action')
ANALYSIS=$(curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq -r '.analysis')
echo "   Action: ${RECOMMENDATION}"
echo "   Analysis: ${ANALYSIS}"
echo ""

# Approve execution
echo "✅ Step 9: Approving execution..."
curl -s -X POST http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID}/approve > /dev/null
echo "   Approval sent"
echo ""

# Monitor execution
echo "⚡ Step 10: Monitoring execution..."
for i in {1..30}; do
    STATUS=$(curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq -r '.status')
    echo "   Status: ${STATUS}"
    
    if [ "$STATUS" = "completed" ]; then
        echo "✅ Execution completed"
        break
    fi
    
    if [ "$STATUS" = "failed" ]; then
        echo "❌ Execution failed"
        curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID} | jq '.'
        exit 1
    fi
    
    if [ $i -eq 30 ]; then
        echo "⏰ Timeout waiting for execution"
        exit 1
    fi
    
    sleep 1
done
echo ""

# Check verification results
echo "🔍 Step 11: Verification results..."
EXECUTION_DETAILS=$(curl -s http://localhost:8080/api/v1/agent/executions/${EXECUTION_ID})
VERIFICATION_PASSED=$(echo $EXECUTION_DETAILS | jq -r '.verification_passed')
SUCCESS=$(echo $EXECUTION_DETAILS | jq -r '.success')

echo "   Verification passed: ${VERIFICATION_PASSED}"
echo "   Success: ${SUCCESS}"

if [ "$SUCCESS" = "true" ]; then
    echo "✅ Remediation successful!"
else
    echo "❌ Remediation failed"
    echo $EXECUTION_DETAILS | jq '.verification_checks'
fi
echo ""

# Check final health
echo "📊 Step 12: Checking final PostgreSQL health..."
sleep 2
FINAL_HEALTH=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].health')
FINAL_IDLE=$(curl -s http://localhost:8002/status | jq -r '.services["postgres-test"].idle_connections')
echo "   Health: ${FINAL_HEALTH}%"
echo "   Idle connections: ${FINAL_IDLE}"

if [ "$FINAL_HEALTH" -ge 70 ]; then
    echo "✅ PostgreSQL health restored!"
else
    echo "⚠️  Health not fully restored (${FINAL_HEALTH}%)"
fi
echo ""

# Check if incident was resolved
echo "📝 Step 13: Checking incident status..."
INCIDENT_STATUS=$(curl -s http://localhost:8080/api/v1/incidents/${INCIDENT_ID} | jq -r '.status')
echo "   Status: ${INCIDENT_STATUS}"

if [ "$INCIDENT_STATUS" = "resolved" ]; then
    echo "✅ Incident automatically resolved!"
else
    echo "⚠️  Incident status: ${INCIDENT_STATUS}"
fi
echo ""

echo "=========================================="
echo "🎉 PostgreSQL AI Agent Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Initial health: ${INITIAL_HEALTH}% → Degraded: ${DEGRADED_HEALTH}% → Final: ${FINAL_HEALTH}%"
echo "  Idle connections: ${INITIAL_IDLE} → ${DEGRADED_IDLE} → ${FINAL_IDLE}"
echo "  Action taken: ${RECOMMENDATION}"
echo "  Result: ${SUCCESS}"
echo "  Incident: ${INCIDENT_STATUS}"
echo ""

