#!/bin/bash

echo "🚀 Setting up Booking Platform Backend for Development"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Start infrastructure services
echo "🐳 Starting PostgreSQL and Redis..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building the application..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   1. Update your .env file with proper configuration"
echo "   2. Run 'npm run start:dev' to start the development server"
echo "   3. Visit http://localhost:3000/api/v1/docs for API documentation"
echo "   4. Visit http://localhost:8080 for database management (Adminer)"
echo "   5. Visit http://localhost:8081 for Redis management"
echo ""
echo "🔧 Useful commands:"
echo "   - npm run start:dev    # Start development server"
echo "   - npm run build        # Build the application"
echo "   - npm run test         # Run tests"
echo "   - docker-compose -f docker-compose.dev.yml logs  # View service logs"
