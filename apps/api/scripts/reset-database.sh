#!/bin/bash

echo "⚠️  WARNING: This will completely delete the database volume and recreate it!"
echo "   All data will be permanently lost!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operation cancelled."
    exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check which docker-compose file to use
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.dev.yml" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
fi

# Stop containers
echo "🛑 Stopping containers..."
docker-compose -f "$COMPOSE_FILE" down

# Get volume name
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    VOLUME_NAME="loopmsq_postgres_data_dev"
else
    VOLUME_NAME="loopmsq_postgres_data"
fi

# Remove volume
echo "🗑️  Removing database volume..."
docker volume rm "$VOLUME_NAME" 2>/dev/null || echo "Volume not found or already removed"

# Start containers again (this will recreate the database)
echo "🚀 Starting containers and recreating database..."
docker-compose -f "$COMPOSE_FILE" up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

echo "✅ Database has been completely reset!"
echo "💡 The database will be recreated with migrations on next API startup"











