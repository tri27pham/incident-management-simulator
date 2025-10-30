#!/bin/bash

# Change Password Script for Incident Management Simulator
# This script helps you change the application password safely

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         🔐 CHANGE PASSWORD - Incident Management Simulator       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found at $ENV_FILE"
    echo ""
    echo "Creating .env file with default password..."
    cat > "$ENV_FILE" << 'EOF'
GROQ_API_KEY=your_groq_api_key_here
# Frontend Authentication
APP_PASSWORD=changeme
EOF
    echo "✅ Created .env with default password: changeme"
    echo ""
fi

# Show current password (if set)
if grep -q "APP_PASSWORD=" "$ENV_FILE"; then
    CURRENT_PASSWORD=$(grep "APP_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)
    echo "📌 Current password: $CURRENT_PASSWORD"
else
    echo "⚠️  No password currently set in .env"
    CURRENT_PASSWORD=""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Prompt for new password
read -p "Enter new password (or press Enter to cancel): " NEW_PASSWORD

# If empty, cancel
if [ -z "$NEW_PASSWORD" ]; then
    echo ""
    echo "⚠️  Password change cancelled."
    exit 0
fi

# Confirm password
read -p "Confirm new password: " CONFIRM_PASSWORD

if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo ""
    echo "❌ Error: Passwords do not match!"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Update .env file
if grep -q "APP_PASSWORD=" "$ENV_FILE"; then
    # Replace existing password
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/^APP_PASSWORD=.*/APP_PASSWORD=$NEW_PASSWORD/" "$ENV_FILE"
    else
        # Linux
        sed -i "s/^APP_PASSWORD=.*/APP_PASSWORD=$NEW_PASSWORD/" "$ENV_FILE"
    fi
    echo "✅ Updated password in .env"
else
    # Add password line
    echo "APP_PASSWORD=$NEW_PASSWORD" >> "$ENV_FILE"
    echo "✅ Added password to .env"
fi

echo ""
echo "🔄 Rebuilding frontend with new password..."
echo ""

cd "$PROJECT_ROOT"

# Check if Docker Compose is running
if ! docker-compose ps | grep -q frontend; then
    echo "⚠️  Frontend is not running. Starting all services..."
    docker-compose up -d --build frontend
else
    echo "♻️  Rebuilding frontend container..."
    docker-compose up -d --build frontend
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ PASSWORD CHANGED SUCCESSFULLY!"
echo ""
echo "🔐 New password: $NEW_PASSWORD"
echo ""
echo "🌐 Access the application:"
echo "   http://localhost:3000"
echo ""
echo "💡 Tips:"
echo "   • All users logged in with the old password will need to log in again"
echo "   • The password is stored in .env and baked into the Docker image"
echo "   • To change it again, run: ./scripts/change-password.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

