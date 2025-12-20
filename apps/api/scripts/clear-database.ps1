# PowerShell script to clear database

Write-Host "🗑️  Clearing database..." -ForegroundColor Yellow

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

# Get the postgres container name
if ($composeFile -eq "docker-compose.dev.yml") {
    $containerName = "booking-postgres-dev"
} else {
    $containerName = "booking-postgres"
}

# Check if container is running
$containerRunning = docker ps --format "{{.Names}}" | Select-String -Pattern $containerName
if (-not $containerRunning) {
    Write-Host "❌ PostgreSQL container ($containerName) is not running." -ForegroundColor Red
    Write-Host "   Please start it first with: docker-compose -f $composeFile up -d postgres" -ForegroundColor Yellow
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "clear-database.sql"

# Execute SQL script to clear database
Write-Host "📝 Executing SQL script to clear all tables..." -ForegroundColor Cyan
Get-Content $sqlFile | docker exec -i $containerName psql -U postgres -d booking_platform

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database cleared successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Note: The admin user will be recreated on next API startup (if ADMIN_OVERWRITE=true)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to clear database. Please check the error above." -ForegroundColor Red
    exit 1
}





















