#!/bin/bash

echo "🔧 Fixing local .env to prevent affecting deployed version..."
echo ""

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup
    echo "✅ Backed up .env to .env.backup"
fi

# Remove VM-specific URLs from .env
echo "🧹 Removing VM URLs from local .env..."

# Remove VITE_API_URL if it points to VM
sed -i.tmp '/VITE_API_URL=.*35\.231\.199\.112/d' .env 2>/dev/null || true
sed -i.tmp '/VITE_API_URL=.*http:\/\/[0-9]/d' .env 2>/dev/null || true

# Remove VITE_HEALTH_MONITOR_URL if it points to VM
sed -i.tmp '/VITE_HEALTH_MONITOR_URL=.*35\.231\.199\.112/d' .env 2>/dev/null || true
sed -i.tmp '/VITE_HEALTH_MONITOR_URL=.*http:\/\/[0-9]/d' .env 2>/dev/null || true

# Clean up temp files
rm -f .env.tmp 2>/dev/null

echo ""
echo "✅ Fixed! Your local .env now uses localhost defaults."
echo ""
echo "📋 Current .env (relevant lines):"
grep -E "(GROQ_API_KEY|GEMINI_API_KEY|VITE_APP_PASSWORD|VITE_API_URL|VITE_HEALTH)" .env || echo "   No VM URLs found (good!)"
echo ""
echo "⚠️  IMPORTANT: You MUST rebuild for changes to take effect:"
echo "   docker compose down"
echo "   docker compose up --build"
echo ""

