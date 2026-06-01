@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   Hyperviseur Solaire - Reconstruction
echo ========================================
echo.

REM Lire HOST_IP depuis le fichier .env
for /f "tokens=2 delims==" %%a in ('findstr /b "HOST_IP=" .env') do set HOST_IP=%%a

if "%HOST_IP%"=="" (
    echo [ERREUR] HOST_IP non trouve dans .env
    set HOST_IP=localhost
)

echo [INFO] Adresse IP detectee: %HOST_IP%
echo.

REM Configurer les variables d'environnement pour docker-compose
set NEXT_PUBLIC_API_URL=https://%HOST_IP%:3001
set NEXT_PUBLIC_RELAY_API_URL=https://%HOST_IP%:3001/api/control

echo [INFO] Configuration:
echo   NEXT_PUBLIC_API_URL = %NEXT_PUBLIC_API_URL%
echo   NEXT_PUBLIC_RELAY_API_URL = %NEXT_PUBLIC_RELAY_API_URL%
echo.

echo [INFO] Arret des conteneurs existants...
docker-compose down
echo.

echo [INFO] Reconstruction des images Docker...
echo   Cette operation peut prendre plusieurs minutes...
docker-compose build --no-cache
echo.

echo [INFO] Demarrage des nouveaux conteneurs...
docker-compose up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Application reconstruite avec succes!
    echo ========================================
    echo.
    echo Accedez a l'application sur:
    echo   https://%HOST_IP%:3000
    echo.
    echo Depuis d'autres PCs sur le reseau:
    echo   https://%HOST_IP%:3000
    echo.
) else (
    echo.
    echo [ERREUR] Echec de la reconstruction
    echo.
)

pause
