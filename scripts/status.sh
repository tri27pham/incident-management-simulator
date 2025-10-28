#!/bin/bash

# Status script for Incident Management Simulator
# Usage: ./status.sh

echo "📊 Incident Management Simulator Status"
echo "========================================"
echo ""

ALL_GOOD=true

# Check PostgreSQL
if docker ps 2>/dev/null | grep -q postgres-dev; then
    echo "✅ PostgreSQL:        Running (Docker: postgres-dev)"
    INCIDENT_COUNT=$(PGPASSWORD=incident_pass psql -h localhost -U incident_user -d incident_db -t -c "SELECT COUNT(*) FROM incidents;" 2>/dev/null | xargs)
    if [ ! -z "$INCIDENT_COUNT" ]; then
        echo "   └─ Incidents:      $INCIDENT_COUNT"
    fi
elif lsof -ti:5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL:        Running (Local: port 5432)"
else
    echo "❌ PostgreSQL:        STOPPED"
    ALL_GOOD=false
fi

# Check Backend
if [ -f /tmp/incident-backend.pid ] && kill -0 $(cat /tmp/incident-backend.pid) 2>/dev/null; then
    if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
        echo "✅ Backend:           Running (PID: $(cat /tmp/incident-backend.pid))"
        echo "   └─ API:            http://localhost:8080 ✓"
        # Check if AI_DIAGNOSIS_URL is set
        AI_URL=$(ps eww $(cat /tmp/incident-backend.pid) | tr ' ' '\n' | grep "AI_DIAGNOSIS_URL" | cut -d= -f2)
        if [ ! -z "$AI_URL" ]; then
            echo "   └─ AI Config:      $AI_URL"
        else
            echo "   └─ AI Config:      ⚠️  NOT SET"
            ALL_GOOD=false
        fi
    else
        echo "⚠️  Backend:           Running but NOT RESPONDING"
        ALL_GOOD=false
    fi
else
    echo "❌ Backend:           STOPPED"
    ALL_GOOD=false
fi

# Check AI Diagnosis
if [ -f /tmp/incident-ai.pid ] && kill -0 $(cat /tmp/incident-ai.pid) 2>/dev/null; then
    if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        echo "✅ AI Diagnosis:      Running (PID: $(cat /tmp/incident-ai.pid))"
        echo "   └─ API:            http://localhost:8000 ✓"
    else
        echo "⚠️  AI Diagnosis:      Running but NOT RESPONDING"
        ALL_GOOD=false
    fi
else
    echo "❌ AI Diagnosis:      STOPPED"
    ALL_GOOD=false
fi

# Check Frontend
if [ -f /tmp/incident-frontend.pid ] && kill -0 $(cat /tmp/incident-frontend.pid) 2>/dev/null; then
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ Frontend:          Running (PID: $(cat /tmp/incident-frontend.pid))"
        echo "   └─ Web:            http://localhost:5173 ✓"
    else
        echo "⚠️  Frontend:          Running but NOT RESPONDING"
        ALL_GOOD=false
    fi
else
    echo "❌ Frontend:          STOPPED"
    ALL_GOOD=false
fi

# Check Generator API
if [ -f /tmp/incident-generator.pid ] && kill -0 $(cat /tmp/incident-generator.pid) 2>/dev/null; then
    if curl -s http://localhost:9000/health > /dev/null 2>&1; then
        echo "✅ Generator API:     Running (PID: $(cat /tmp/incident-generator.pid))"
        echo "   └─ API:            http://localhost:9000 ✓"
        # Check generator status
        GEN_STATUS=$(curl -s http://localhost:9000/api/status 2>/dev/null | grep -o '"is_running":[^,}]*' | cut -d: -f2)
        if [ "$GEN_STATUS" = "true" ]; then
            echo "   └─ Generator:      🟢 ACTIVE (creating incidents)"
        else
            echo "   └─ Generator:      ⚪ IDLE (use UI button to start)"
        fi
    else
        echo "⚠️  Generator API:     Running but NOT RESPONDING"
        ALL_GOOD=false
    fi
else
    echo "❌ Generator API:     STOPPED"
    ALL_GOOD=false
fi

# Check Redis Test
if docker ps 2>/dev/null | grep -q redis-test; then
    echo "✅ Redis Test:        Running (Docker: redis-test)"
    # Check Redis memory
    REDIS_INFO=$(docker exec redis-test redis-cli INFO memory 2>/dev/null | grep "used_memory:" | head -1 | cut -d: -f2 | tr -d '\r')
    if [ ! -z "$REDIS_INFO" ]; then
        REDIS_MB=$((REDIS_INFO / 1024 / 1024))
        echo "   └─ Memory:         ${REDIS_MB}MB / 50MB"
    fi
else
    echo "⚠️  Redis Test:        STOPPED (AI agent features disabled)"
fi

# Check PostgreSQL Test
if docker ps 2>/dev/null | grep -q postgres-test; then
    echo "✅ PostgreSQL Test:   Running (Docker: postgres-test)"
else
    echo "⚠️  PostgreSQL Test:   STOPPED (AI agent features disabled)"
fi

# Check Health Monitor
if docker ps 2>/dev/null | grep -q health-monitor; then
    if curl -s http://localhost:8002/health > /dev/null 2>&1; then
        echo "✅ Health Monitor:    Running (Docker)"
        echo "   └─ API:            http://localhost:8002 ✓"
        # Check what services it's monitoring
        HEALTH_STATUS=$(curl -s http://localhost:8002/status 2>/dev/null)
        if [ ! -z "$HEALTH_STATUS" ]; then
            # Parse Redis health
            REDIS_HEALTH=$(echo "$HEALTH_STATUS" | jq -r '.services["redis-test"].health' 2>/dev/null)
            if [ ! -z "$REDIS_HEALTH" ] && [ "$REDIS_HEALTH" != "null" ]; then
                echo "   └─ Redis:          ${REDIS_HEALTH}% health"
            fi
            
            # Parse PostgreSQL health
            PG_HEALTH=$(echo "$HEALTH_STATUS" | jq -r '.services["postgres-test"].health' 2>/dev/null)
            if [ ! -z "$PG_HEALTH" ] && [ "$PG_HEALTH" != "null" ]; then
                echo "   └─ PostgreSQL:     ${PG_HEALTH}% health"
            fi
            
            # Parse Disk space health
            DISK_HEALTH=$(echo "$HEALTH_STATUS" | jq -r '.services["disk-space"].health' 2>/dev/null)
            if [ ! -z "$DISK_HEALTH" ] && [ "$DISK_HEALTH" != "null" ]; then
                DISK_USED=$(echo "$HEALTH_STATUS" | jq -r '.services["disk-space"].used_percent' 2>/dev/null)
                echo "   └─ Disk Space:     ${DISK_HEALTH}% health (${DISK_USED}% used)"
            fi
        fi
    else
        echo "⚠️  Health Monitor:    Running but NOT RESPONDING"
    fi
else
    echo "⚠️  Health Monitor:    STOPPED (auto-incidents disabled)"
fi

echo ""
echo "========================================"
if [ "$ALL_GOOD" = true ]; then
    echo "🎉 All critical services are healthy!"
else
    echo "⚠️  Some services need attention"
    echo ""
    echo "💡 Quick fixes:"
    echo "   ./logs.sh [service] - Check logs"
    echo "   ./stop.sh          - Stop all"
    echo "   ./start.sh         - Start all"
fi
echo ""
echo "📝 Commands:"
echo "   ./logs.sh [service] - View logs"
echo "   ./stop.sh          - Stop all services"
echo "   ./start.sh         - Start all services"
echo ""

