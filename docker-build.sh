#!/bin/bash
# Docker Build Script with timeout handling
# Usage: ./docker-build.sh [service_name]
# Example: ./docker-build.sh admin
# Or: ./docker-build.sh (to build all)

SERVICE=$1

echo "=== Docker Build Script ==="

# Set extended timeouts
export COMPOSE_HTTP_TIMEOUT=600
export DOCKER_CLIENT_TIMEOUT=600
export BUILDKIT_PROGRESS=plain

echo "Setting Docker timeouts to 600 seconds..."

# Pre-pull base images to avoid timeout during build
echo ""
echo "Pre-pulling base images..."

images=(
    "node:20"
    "node:20-alpine"
    "node:18-alpine"
)

for image in "${images[@]}"; do
    echo "Pulling $image..."
    retries=3
    pulled=false
    
    for ((i=1; i<=retries; i++)); do
        if docker pull "$image" 2>&1 > /dev/null; then
            echo "  ✓ Successfully pulled $image"
            pulled=true
            break
        fi
        
        if [ $i -lt $retries ]; then
            echo "  ✗ Attempt $i failed for $image"
            echo "  Retrying in 5 seconds..."
            sleep 5
        fi
    done
    
    if [ "$pulled" = false ]; then
        echo "  Warning: Could not pull $image after $retries attempts"
        echo "  Build will attempt to use cached version or pull during build"
    fi
done

# Build containers
echo ""
echo "=== Building Docker Containers ==="

if [ -z "$SERVICE" ]; then
    echo "Building all services..."
    docker-compose build --no-cache
else
    echo "Building service: $SERVICE..."
    docker-compose build --no-cache "$SERVICE"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Build completed successfully!"
    echo ""
    echo "To start containers, run:"
    if [ -z "$SERVICE" ]; then
        echo "  docker-compose up -d"
    else
        echo "  docker-compose up -d $SERVICE"
    fi
else
    echo ""
    echo "✗ Build failed!"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check your internet connection"
    echo "2. Verify Docker is running"
    echo "3. Try configuring a registry mirror"
    echo "4. Check if your firewall/proxy is blocking Docker Hub"
    echo "5. Run: docker system prune -a (to clean up and retry)"
fi

