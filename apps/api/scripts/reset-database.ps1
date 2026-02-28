# PowerShell script to completely reset database (delete volume)

Write-Host "⚠️  WARNING: This will completely delete the database volume and recreate it!" -ForegroundColor Red
Write-Host "   All data will be permanently lost!" -ForegroundColor Red
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Operation cancelled." -ForegroundColor Yellow
    exit 0
}

# Check if Docker is running
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check which docker-compose file to use
$composeFile = "docker-compose.yml"
if (Test-Path "docker-compose.dev.yml") {
    $composeFile = "docker-compose.dev.yml"
}

# Stop containers
Write-Host "🛑 Stopping containers..." -ForegroundColor Yellow
docker-compose -f $composeFile down

# Get volume name
if ($composeFile -eq "docker-compose.dev.yml") {
    $volumeName = "loopmsq_postgres_data_dev"
} else {
    $volumeName = "loopmsq_postgres_data"
}

# Remove volume
Write-Host "🗑️  Removing database volume..." -ForegroundColor Yellow
docker volume rm $volumeName 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Volume not found or already removed" -ForegroundColor Cyan
}

# Start containers again (this will recreate the database)
Write-Host "🚀 Starting containers and recreating database..." -ForegroundColor Cyan
docker-compose -f $composeFile up -d postgres

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host "✅ Database has been completely reset!" -ForegroundColor Green
Write-Host "💡 The database will be recreated with migrations on next API startup" -ForegroundColor Cyan

























