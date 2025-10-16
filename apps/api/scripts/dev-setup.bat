@echo off
echo 🚀 Setting up Booking Platform Backend for Development

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from .env.example...
    copy .env.example .env
    echo ✅ .env file created. Please update it with your configuration.
)

REM Start infrastructure services
echo 🐳 Starting PostgreSQL and Redis...
docker-compose -f docker-compose.dev.yml up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Build the application
echo 🔨 Building the application...
npm run build

echo ✅ Setup complete!
echo.
echo 🎯 Next steps:
echo    1. Update your .env file with proper configuration
echo    2. Run 'npm run start:dev' to start the development server
echo    3. Visit http://localhost:3000/api/v1/docs for API documentation
echo    4. Visit http://localhost:8080 for database management (Adminer)
echo    5. Visit http://localhost:8081 for Redis management
echo.
echo 🔧 Useful commands:
echo    - npm run start:dev    # Start development server
echo    - npm run build        # Build the application
echo    - npm run test         # Run tests
echo    - docker-compose -f docker-compose.dev.yml logs  # View service logs

pause
