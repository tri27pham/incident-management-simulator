#!/bin/bash

# Log viewer script for Incident Management Simulator
# Usage: ./logs.sh [service]
# Services: backend, frontend, ai, generator, health, redis, all

SERVICE=${1:-"all"}

case $SERVICE in
    backend|back|be)
        echo "📊 Viewing Backend logs (Ctrl+C to exit)..."
        echo ""
        tail -f /tmp/incident-backend.log
        ;;
    frontend|front|fe)
        echo "🎨 Viewing Frontend logs (Ctrl+C to exit)..."
        echo ""
        tail -f /tmp/incident-frontend.log
        ;;
    ai|diagnosis)
        echo "🤖 Viewing AI Diagnosis logs (Ctrl+C to exit)..."
        echo ""
        tail -f /tmp/incident-ai.log
        ;;
    generator|gen)
        echo "🎲 Viewing Incident Generator logs (Ctrl+C to exit)..."
        echo ""
        tail -f /tmp/incident-generator.log
        ;;
    health|monitor|health-monitor)
        echo "🏥 Viewing Health Monitor logs (Ctrl+C to exit)..."
        echo ""
        docker logs -f health-monitor-standalone 2>/dev/null || docker logs -f health-monitor 2>/dev/null || echo "❌ Health monitor not running"
        ;;
    redis|redis-test)
        echo "🔴 Viewing Redis Test logs (Ctrl+C to exit)..."
        echo ""
        docker logs -f redis-test 2>/dev/null || echo "❌ Redis test not running"
        ;;
    all|*)
        echo "📊 Viewing ALL logs (Ctrl+C to exit)..."
        echo ""
        echo "💡 Tip: Use './logs.sh backend' or './logs.sh health' to view just one service"
        echo ""
        echo "Available services: backend, frontend, ai, generator, health, redis, all"
        echo ""
        tail -f /tmp/incident-*.log
        ;;
esac

