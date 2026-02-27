# Build script for TSSLLM
# Builds frontend and copies dist into backend/static for single-service deployment

Write-Host "Building frontend..."
Push-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Frontend build failed"; exit 1 }
Pop-Location

Write-Host "Copying dist to backend/static..."
$staticDir = "$PSScriptRoot\backend\static"
if (Test-Path $staticDir) { Remove-Item -Recurse -Force $staticDir }
Copy-Item -Recurse "$PSScriptRoot\frontend\dist" $staticDir

Write-Host "Build complete. Deploy with:"
Write-Host "  cd backend && az webapp up --name tssllm --runtime 'PYTHON:3.11' --sku B1"
