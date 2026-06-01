@echo off
chcp 65001 >nul
echo.
echo =======================================================
echo   Hyperviseur - Reconstruction LOCALE (Kubernetes)
echo =======================================================
echo.

REM 1. Configuration
set FRONTEND_IMAGE=hyperviseur-frontend:local
set BACKEND_IMAGE=hyperviseur-backend:local
set HELM_RELEASE=hyperviseur-local
set PUBLIC_URL=http://localhost:8081

if "%OPENWEATHER_KEY%"=="" set OPENWEATHER_KEY=

echo [INFO] URL Publique cible : %PUBLIC_URL%
echo [INFO] Release Helm : %HELM_RELEASE%
echo.

REM 2. Build Backend
echo [1/4] Construction de l'image BACKEND (%BACKEND_IMAGE%)...
docker build -t %BACKEND_IMAGE% ./backend
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Echec du build Backend.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Image Backend construite.
echo.

REM 3. Build Frontend
echo [2/4] Construction de l'image FRONTEND (%FRONTEND_IMAGE%)...
echo       Arg: NEXT_PUBLIC_API_URL=%PUBLIC_URL%
docker build --build-arg NEXT_PUBLIC_API_URL=%PUBLIC_URL% --build-arg NEXT_PUBLIC_OPENWEATHER_API_KEY=%OPENWEATHER_KEY% -t %FRONTEND_IMAGE% .
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Echec du build Frontend.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Image Frontend construite.
echo.

REM 4. Upgrade Helm
echo [3/4] Mise a jour du deploiment Helm...
echo       Utilisation de values.yaml + values-local.yaml
helm upgrade --install %HELM_RELEASE% ./hi2-helm -f ./hi2-helm/values.yaml -f ./hi2-helm/values-local.yaml --set backend.image.pullPolicy=IfNotPresent --set frontend.image.pullPolicy=Never --set polling.image.pullPolicy=IfNotPresent
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Echec de la commande Helm.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Helm upgrade termine.
echo.

REM 5. Restart Pods
echo [4/4] Redemarrage des pods pour prise en compte immediate...
kubectl rollout restart deployment/%HELM_RELEASE%-hi2-helm-backend
kubectl rollout restart deployment/%HELM_RELEASE%-hi2-helm-frontend
kubectl rollout restart deployment/%HELM_RELEASE%-hi2-helm-polling
echo.

echo =======================================================
echo   SUCCES ! Environnement local reconstruit.
echo =======================================================
echo.
pause
