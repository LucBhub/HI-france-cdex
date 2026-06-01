@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   Hyperviseur Preprod - Port Forward
echo ========================================
echo.
echo [INFO] Démarrage du port-forwarding vers le cluster preprod...
echo.
echo Les services suivants seront accessibles:
echo   - Frontend: http://localhost:8081
echo   - Backend API: http://localhost:8082
echo.

REM Port-forward frontend (HTTP)
echo [INFO] Port-forward Frontend sur http://localhost:8081...
start "HI2 Frontend" kubectl port-forward svc/hyperviseur-local-hi2-helm-frontend 8081:3000

REM Port-forward backend (HTTP)
echo [INFO] Port-forward Backend sur http://localhost:8082...
start "HI2 Backend" kubectl port-forward svc/hyperviseur-local-hi2-helm-backend 8082:3001

echo.
echo ========================================
echo   Port-forwarding actif!
echo ========================================
echo.
echo Accédez à l'application:
echo   http://localhost:8081
echo.
echo Appuyez sur une touche pour ouvrir le navigateur...
pause >nul

start http://localhost:8081

echo.
echo [INFO] Fermez cette fenêtre pour arrêter le port-forwarding
echo        ou fermez les fenêtres de commande ouvertes.
pause
