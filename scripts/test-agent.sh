#!/bin/bash

# Test script for AI Agent Remediation

set -e

echo "🤖 AI Agent Remediation Test Script"
echo "===================================="
echo ""

BACKEND_URL="http://localhost:8080/api/v1"

# Step 1: Trigger Redis memory failure to create a real incident
echo "📊 Step 1: Triggering Redis memory failure..."
curl -s -X POST http://localhost:8002/trigger/redis-memory > /dev/null
echo "✅ Redis memory exhaustion triggered - incident should be created automatically"
echo ""

# Step 2: Wait for incident to be created
echo "⏳ Waiting 6 seconds for incident creation..."
sleep 6
echo ""

# Step 3: Get the latest incident
echo "📋 Step 3: Fetching latest incident..."
INCIDENTS=$(curl -s "$BACKEND_URL/incidents")
INCIDENT_ID=$(echo "$INCIDENTS" | jq -r '.[0].id')

if [ "$INCIDENT_ID" == "null" ] || [ -z "$INCIDENT_ID" ]; then
  echo "❌ No incidents found. Please check if services are running."
  exit 1
fi

echo "✅ Found incident: $INCIDENT_ID"
echo ""

# Step 4: Check if incident is actionable
INCIDENT=$(curl -s "$BACKEND_URL/incidents" | jq -r ".[0]")
ACTIONABLE=$(echo "$INCIDENT" | jq -r '.actionable')
INCIDENT_TYPE=$(echo "$INCIDENT" | jq -r '.incident_type')
REMEDIATION_MODE=$(echo "$INCIDENT" | jq -r '.remediation_mode')

echo "📊 Incident Details:"
echo "   - ID: $INCIDENT_ID"
echo "   - Message: $(echo "$INCIDENT" | jq -r '.message')"
echo "   - Type: $INCIDENT_TYPE"
echo "   - Actionable: $ACTIONABLE"
echo "   - Remediation Mode: $REMEDIATION_MODE"
echo ""

if [ "$ACTIONABLE" != "true" ] || [ "$INCIDENT_TYPE" != "real_system" ]; then
  echo "⚠️  Warning: Incident is not marked as actionable or not a real_system incident"
  echo "   Agent may not be able to act on this incident"
  echo ""
fi

# Step 5: Start AI Agent Remediation
echo "🤖 Step 5: Starting AI Agent Remediation..."
AGENT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/incidents/$INCIDENT_ID/agent/remediate")
EXECUTION_ID=$(echo "$AGENT_RESPONSE" | jq -r '.id')

if [ "$EXECUTION_ID" == "null" ] || [ -z "$EXECUTION_ID" ]; then
  echo "❌ Failed to start agent remediation"
  echo "Response: $AGENT_RESPONSE"
  exit 1
fi

echo "✅ Agent remediation started!"
echo "   Execution ID: $EXECUTION_ID"
echo ""

# Step 6: Poll for agent progress
echo "🔄 Step 6: Monitoring agent progress..."
echo ""

for i in {1..30}; do
  EXECUTION=$(curl -s "$BACKEND_URL/agent/executions/$EXECUTION_ID")
  STATUS=$(echo "$EXECUTION" | jq -r '.status')
  
  case "$STATUS" in
    "thinking")
      echo "   [$(date +%H:%M:%S)] 🧠 Thinking - Analyzing incident..."
      ;;
    "previewing")
      echo "   [$(date +%H:%M:%S)] 📋 Previewing - Generating commands..."
      ;;
    "awaiting_approval")
      echo "   [$(date +%H:%M:%S)] ⏳ Awaiting Approval - Commands ready..."
      ;;
    "executing")
      echo "   [$(date +%H:%M:%S)] ⚡ Executing - Running remediation commands..."
      ;;
    "verifying")
      echo "   [$(date +%H:%M:%S)] 🔍 Verifying - Checking if fix worked..."
      ;;
    "completed")
      SUCCESS=$(echo "$EXECUTION" | jq -r '.success')
      echo "   [$(date +%H:%M:%S)] ✅ Completed!"
      echo ""
      echo "📊 Final Results:"
      echo "   - Status: $STATUS"
      echo "   - Success: $SUCCESS"
      
      # Show analysis
      ANALYSIS=$(echo "$EXECUTION" | jq -r '.analysis')
      if [ "$ANALYSIS" != "null" ]; then
        echo "   - Analysis: $ANALYSIS"
      fi
      
      # Show recommended action
      ACTION=$(echo "$EXECUTION" | jq -r '.recommended_action')
      if [ "$ACTION" != "null" ]; then
        echo "   - Action Taken: $ACTION"
      fi
      
      # Show verification
      VERIFICATION_PASSED=$(echo "$EXECUTION" | jq -r '.verification_passed')
      if [ "$VERIFICATION_PASSED" != "null" ]; then
        echo "   - Verification: $VERIFICATION_PASSED"
      fi
      
      echo ""
      echo "🎉 AI Agent successfully remediated the incident!"
      exit 0
      ;;
    "failed")
      ERROR=$(echo "$EXECUTION" | jq -r '.error_message')
      echo "   [$(date +%H:%M:%S)] ❌ Failed: $ERROR"
      exit 1
      ;;
  esac
  
  sleep 2
done

echo ""
echo "⏰ Timeout: Agent is still running after 60 seconds"
echo "   Check the backend logs for more details: docker logs backend -f"
echo "   Or check execution status manually:"
echo "   curl $BACKEND_URL/agent/executions/$EXECUTION_ID | jq"

