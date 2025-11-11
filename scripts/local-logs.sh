#!/bin/bash

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "📝 Showing logs for all services..."
    echo "💡 Tip: ./scripts/local-logs.sh [service] to filter"
    echo ""
    docker compose logs -f --tail=50
else
    echo "📝 Showing logs for: $SERVICE"
    echo ""
    docker compose logs -f --tail=100 "$SERVICE"
fi

