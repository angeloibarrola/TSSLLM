# TSSLLM Azure Deployment Script
# Run this in YOUR OWN PowerShell terminal (not inside Copilot)
# Usage: .\deploy.ps1

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== TSSLLM Azure Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login (personal tenant 073e8806-8507-48c8-be1b-5b8d2ba6683a)
Write-Host "Step 1: Logging into Azure personal account..." -ForegroundColor Yellow
az login --tenant 073e8806-8507-48c8-be1b-5b8d2ba6683a
if ($LASTEXITCODE -ne 0) { Write-Host "Login failed." -ForegroundColor Red; exit 1 }

# Step 2: Subscription is auto-selected (Visual Studio Enterprise Subscription)
Write-Host ""
Write-Host "Step 2: Confirming subscription..." -ForegroundColor Yellow
az account show --output table

# Step 3: Build frontend
Write-Host ""
Write-Host "Step 3: Building frontend..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Frontend build failed." -ForegroundColor Red; exit 1 }
Pop-Location

Write-Host "Copying dist to backend/static..."
$staticDir = "$PSScriptRoot\backend\static"
if (Test-Path $staticDir) { Remove-Item -Recurse -Force $staticDir }
Copy-Item -Recurse "$PSScriptRoot\frontend\dist" $staticDir
Write-Host "Build complete." -ForegroundColor Green

# Step 4: Deploy
Write-Host ""
Write-Host "Step 4: Deploying to Azure App Service (this takes a few minutes)..." -ForegroundColor Yellow
$appName = "tssllm-app"
Push-Location "$PSScriptRoot\backend"
az webapp up `
    --name $appName `
    --runtime "PYTHON:3.11" `
    --sku B1 `
    --os-type Linux
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Deployment failed." -ForegroundColor Red; exit 1 }
Pop-Location
Write-Host "App deployed." -ForegroundColor Green

# Step 5: Get resource group
$rgName = (az webapp show --name $appName --query resourceGroup --output tsv 2>$null)
if (-not $rgName) { $rgName = "vino_1105_rg_9916" }
Write-Host "Resource group: $rgName" -ForegroundColor Cyan

# Step 6: Set startup command
Write-Host ""
Write-Host "Step 5: Configuring startup command..." -ForegroundColor Yellow
az webapp config set `
    --name $appName `
    --resource-group $rgName `
    --startup-file "gunicorn app.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120"

# Step 7: Enable WebSockets
Write-Host "Step 6: Enabling WebSockets..." -ForegroundColor Yellow
az webapp config set `
    --name $appName `
    --resource-group $rgName `
    --web-sockets-enabled true

# Step 8: Set persistent storage paths (data survives restarts under /home)
Write-Host "Step 7: Configuring persistent storage paths..." -ForegroundColor Yellow
az webapp config appsettings set `
    --name $appName `
    --resource-group $rgName `
    --settings DATABASE_URL="sqlite:////home/tssllm.db" CHROMA_PERSIST_DIR="/home/chroma_data" UPLOAD_DIR="/home/uploads" SEED_DATA_DIR="/home/site/wwwroot/seed_data"

# Step 9: Migrate DB schema (add name column if missing)
Write-Host "Step 8: Running database migration..." -ForegroundColor Yellow
$migrationCmd = "python3 -c `"import sqlite3; db=sqlite3.connect('/home/tssllm.db'); cols=[r[1] for r in db.execute('PRAGMA table_info(workspaces)')]; db.execute('ALTER TABLE workspaces ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT ''Untitled Notebook''') if 'name' not in cols else None; db.commit(); print('Migration OK')`""
az webapp ssh --name $appName --resource-group $rgName --command $migrationCmd 2>$null
Write-Host "Migration complete." -ForegroundColor Green

# Step 9: Optional GITHUB_TOKEN
Write-Host ""
$token = Read-Host "Enter your GITHUB_TOKEN for AI features (or press Enter to skip)"
if ($token -ne "") {
    az webapp config appsettings set `
        --name $appName `
        --resource-group $rgName `
        --settings GITHUB_TOKEN=$token
}

# Done
$url = "https://$appName.azurewebsites.net"
Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host "App URL: $url" -ForegroundColor Cyan
Write-Host "Health:  $url/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening in browser..." -ForegroundColor Yellow
Start-Process $url
