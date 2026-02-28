#!/bin/bash

echo "🗑️  Clearing database..."

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

# Get the postgres container name
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    CONTAINER_NAME="booking-postgres-dev"
else
    CONTAINER_NAME="booking-postgres"
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ PostgreSQL container ($CONTAINER_NAME) is not running."
    echo "   Please start it first with: docker-compose -f $COMPOSE_FILE up -d postgres"
    exit 1
fi

# Execute SQL script to clear database
echo "📝 Executing SQL script to clear all tables..."
docker exec -i "$CONTAINER_NAME" psql -U postgres -d booking_platform < "$(dirname "$0")/clear-database.sql"

if [ $? -eq 0 ]; then
    echo "✅ Database cleared successfully!"
    echo ""
    echo "💡 Note: The admin user will be recreated on next API startup (if ADMIN_OVERWRITE=true)"
else
    echo "❌ Failed to clear database. Please check the error above."
    exit 1
fi

























