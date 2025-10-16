# Docker Build Script with timeout handling
# Usage: .\docker-build.ps1 [service_name]
# Example: .\docker-build.ps1 admin
# Or: .\docker-build.ps1 (to build all)

param(
    [string]$Service = ""
)

Write-Host "=== Docker Build Script ===" -ForegroundColor Green

# Set extended timeouts
$env:COMPOSE_HTTP_TIMEOUT = "600"
$env:DOCKER_CLIENT_TIMEOUT = "600"
$env:BUILDKIT_PROGRESS = "plain"

Write-Host "Setting Docker timeouts to 600 seconds..." -ForegroundColor Yellow

# Pre-pull base images to avoid timeout during build
Write-Host "`nPre-pulling base images..." -ForegroundColor Yellow

$images = @(
    "node:20",
    "node:20-alpine",
    "node:18-alpine"
)

foreach ($image in $images) {
    Write-Host "Pulling $image..." -ForegroundColor Cyan
    $retries = 3
    $pulled = $false
    
    for ($i = 1; $i -le $retries; $i++) {
        try {
            docker pull $image 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Successfully pulled $image" -ForegroundColor Green
                $pulled = $true
                break
            }
        }
        catch {
            Write-Host "  ✗ Attempt $i failed for $image" -ForegroundColor Red
        }
        
        if ($i -lt $retries) {
            Write-Host "  Retrying in 5 seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    }
    
    if (-not $pulled) {
        Write-Host "  Warning: Could not pull $image after $retries attempts" -ForegroundColor Yellow
        Write-Host "  Build will attempt to use cached version or pull during build" -ForegroundColor Yellow
    }
}

# Build containers
Write-Host "`n=== Building Docker Containers ===" -ForegroundColor Green

if ($Service -eq "") {
    Write-Host "Building all services..." -ForegroundColor Cyan
    docker-compose build --no-cache
} else {
    Write-Host "Building service: $Service..." -ForegroundColor Cyan
    docker-compose build --no-cache $Service
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Build completed successfully!" -ForegroundColor Green
    Write-Host "`nTo start containers, run:" -ForegroundColor Yellow
    if ($Service -eq "") {
        Write-Host "  docker-compose up -d" -ForegroundColor Cyan
    } else {
        Write-Host "  docker-compose up -d $Service" -ForegroundColor Cyan
    }
} else {
    Write-Host "`n✗ Build failed!" -ForegroundColor Red
    Write-Host "`nTroubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor White
    Write-Host "2. Verify Docker Desktop is running" -ForegroundColor White
    Write-Host "3. Try configuring a registry mirror in Docker Desktop settings" -ForegroundColor White
    Write-Host "4. Check if your firewall/proxy is blocking Docker Hub" -ForegroundColor White
    Write-Host "5. Run: docker system prune -a (to clean up and retry)" -ForegroundColor White
}

