#!/usr/bin/env pwsh
# Script pour changer l'adresse IP de l'application Hyperviseur
# Usage: .\change-ip.ps1 <nouvelle_ip>
# Exemple: .\change-ip.ps1 localhost
# Exemple: .\change-ip.ps1 10.16.0.100

param(
    [Parameter(Mandatory=$true)]
    [string]$NewIP
)

Write-Host "🔧 Changement de l'adresse IP vers: $NewIP" -ForegroundColor Cyan

# Lire le fichier .env
$envFile = Get-Content .env

# Mettre à jour les variables
$updatedEnv = $envFile | ForEach-Object {
    if ($_ -match '^HOST_IP=') {
        "HOST_IP=$NewIP"
    }
    elseif ($_ -match '^NEXT_PUBLIC_API_URL=') {
        "NEXT_PUBLIC_API_URL=http://${NewIP}:3001"
    }
    elseif ($_ -match '^NEXT_PUBLIC_RELAY_API_URL=') {
        "NEXT_PUBLIC_RELAY_API_URL=http://${NewIP}:3001/api/control"
    }
    else {
        $_
    }
}

# Sauvegarder le nouveau fichier .env
$updatedEnv | Set-Content .env

Write-Host "✅ Fichier .env mis à jour avec l'IP: $NewIP" -ForegroundColor Green

# Demander confirmation pour rebuild
$rebuild = Read-Host "Voulez-vous reconstruire et redémarrer les conteneurs maintenant? (o/n)"

if ($rebuild -eq 'o' -or $rebuild -eq 'O') {
    Write-Host "🔄 Arrêt des conteneurs..." -ForegroundColor Yellow
    docker-compose down
    
    Write-Host "🔨 Reconstruction SANS cache (cela peut prendre quelques minutes)..." -ForegroundColor Yellow
    docker-compose build --no-cache
    
    Write-Host "🚀 Démarrage des conteneurs..." -ForegroundColor Yellow
    docker-compose up -d
    
    Write-Host "✅ Application redémarrée avec la nouvelle IP!" -ForegroundColor Green
    Write-Host "🌐 Accédez à l'application sur: http://${NewIP}:3000" -ForegroundColor Cyan
}
else {
    Write-Host "⚠️  N'oubliez pas de rebuild manuellement:" -ForegroundColor Yellow
    Write-Host "   docker-compose down" -ForegroundColor White
    Write-Host "   docker-compose build --no-cache" -ForegroundColor White
    Write-Host "   docker-compose up -d" -ForegroundColor White
}

