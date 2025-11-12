#!/bin/bash

# Script to switch .env configuration between local and VM deployment

VM_IP="35.231.199.112" # Your VM's public IP
ENV_FILE=".env"

# Function to remove VITE_API_URL
remove_vm_url() {
    if [ -f "$ENV_FILE" ]; then
        # Remove VITE_API_URL line (works on both macOS and Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' '/VITE_API_URL=/d' "$ENV_FILE"
        else
            sed -i '/VITE_API_URL=/d' "$ENV_FILE"
        fi
    fi
}

# Function to add VM URL
add_vm_url() {
    remove_vm_url # Ensure no duplicates
    echo "VITE_API_URL=http://$VM_IP:8080/api/v1" >> "$ENV_FILE"
}

# Check current mode
check_mode() {
    if grep -q "VITE_API_URL=http://$VM_IP" "$ENV_FILE" 2>/dev/null; then
        echo "🌐 Current mode: VM (Frontend points to $VM_IP)"
    else
        echo "🏠 Current mode: Local (Frontend points to localhost)"
    fi
}

case "$1" in
    local)
        echo "Switching to LOCAL mode..."
        remove_vm_url
        echo "✅ Switched to LOCAL mode."
        echo ""
        echo "⚠️  You must rebuild the frontend for changes to take effect:"
        echo "   docker compose up --build -d frontend"
        echo ""
        check_mode
        ;;
    vm)
        echo "Switching to VM mode..."
        add_vm_url
        echo "✅ Switched to VM mode."
        echo ""
        echo "⚠️  You must rebuild the frontend for changes to take effect:"
        echo "   docker compose up --build -d frontend"
        echo ""
        check_mode
        ;;
    *)
        check_mode
        echo ""
        echo "Usage: $0 [local|vm]"
        echo ""
        echo "  local: Configure .env for local development"
        echo "         Frontend will talk to http://localhost:8080"
        echo ""
        echo "  vm:    Configure .env to test against VM deployment"
        echo "         Frontend will talk to http://$VM_IP:8080"
        echo ""
        echo "After switching, rebuild frontend: docker compose up --build -d frontend"
        ;;
esac

