#!/bin/bash

# Detect Architecture
ARCH=$(uname -m)
OS=$(uname -s)

echo "Detected System: $OS ($ARCH)"

case "$ARCH" in
    arm64|aarch64)
        echo "🍎 Target: Apple Silicon / ARM64"
        COMPOSE_FILE="docker-compose.mac.yml"
        ;;
    x86_64|amd64)
        echo "💻 Target: Windows / Intel / x86_64"
        COMPOSE_FILE="docker-compose.yml"
        ;;
    *)
        echo "⚠️  Unknown architecture: $ARCH, falling back to default docker-compose.yml"
        COMPOSE_FILE="docker-compose.yml"
        ;;
esac

# Check for command
COMMAND=${1:-"up"}

if [ "$COMMAND" == "up" ]; then
    echo "🚀 Starting FinPal with $COMPOSE_FILE..."
    docker compose -f "$COMPOSE_FILE" up -d --build
elif [ "$COMMAND" == "down" ]; then
    echo "🛑 Stopping FinPal ($COMPOSE_FILE)..."
    docker compose -f "$COMPOSE_FILE" down
elif [ "$COMMAND" == "logs" ]; then
    docker compose -f "$COMPOSE_FILE" logs -f
else
    echo "🛠  Running: docker compose -f $COMPOSE_FILE $@"
    docker compose -f "$COMPOSE_FILE" "$@"
fi
