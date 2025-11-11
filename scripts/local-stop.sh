#!/bin/bash

echo "🛑 Stopping Incident Management Simulator..."
echo ""

docker compose down

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 To start again: ./scripts/local-start.sh"
echo "🗑️  Remove data:    docker compose down -v"
echo ""

