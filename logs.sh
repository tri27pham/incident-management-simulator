#!/bin/bash

# Log viewer script for Incident Management Simulator
# Usage: ./logs.sh [service]
# Services: backend, frontend, ai, generator, all

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
    all|*)
        echo "📊 Viewing ALL logs (Ctrl+C to exit)..."
        echo ""
        echo "💡 Tip: Use './logs.sh backend' to view just one service"
        echo ""
        tail -f /tmp/incident-*.log
        ;;
esac

