@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   Hyperviseur Solaire - Arret
echo ========================================
echo.

echo [INFO] Arret des conteneurs Docker...
docker-compose down

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Application arretee avec succes!
    echo.
) else (
    echo.
    echo [ERREUR] Echec de l'arret
    echo.
)

pause
