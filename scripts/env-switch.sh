#!/bin/bash

MODE=$1

if [ -z "$MODE" ]; then
    echo "Usage: ./scripts/env-switch.sh [local|vm]"
    echo ""
    echo "Current mode:"
    if grep -q "VITE_API_URL.*35\.231" .env 2>/dev/null; then
        echo "  🌐 VM mode (pointing to 35.231.199.112)"
    else
        echo "  🏠 Local mode (using localhost)"
    fi
    exit 0
fi

case $MODE in
    local)
        echo "🏠 Switching to LOCAL mode..."
        # Remove VM URLs
        sed -i.bak '/VITE_API_URL=/d' .env
        sed -i.bak '/VITE_HEALTH_MONITOR_URL=/d' .env
        rm -f .env.bak
        echo "✅ Local mode activated"
        echo "   Frontend will use: http://localhost:8080/api/v1"
        echo ""
        echo "⚠️  REBUILD REQUIRED:"
        echo "   docker compose down && docker compose up --build"
        ;;
    vm|prod|production)
        echo "🌐 Switching to VM mode..."
        # Remove existing URLs first
        sed -i.bak '/VITE_API_URL=/d' .env
        sed -i.bak '/VITE_HEALTH_MONITOR_URL=/d' .env
        rm -f .env.bak
        # Add VM URLs
        echo "" >> .env
        echo "# VM URLs (added by env-switch.sh)" >> .env
        echo "VITE_API_URL=http://35.231.199.112:8080/api/v1" >> .env
        echo "✅ VM mode activated"
        echo "   Frontend will use: http://35.231.199.112:8080/api/v1"
        echo ""
        echo "⚠️  REBUILD REQUIRED:"
        echo "   docker compose down && docker compose up --build"
        ;;
    *)
        echo "❌ Invalid mode: $MODE"
        echo "   Use: local, vm, prod, or production"
        exit 1
        ;;
esac

