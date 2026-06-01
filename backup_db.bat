@echo off
setlocal

:: Configuration
set "SOURCE_DIR=backend\db"
set "BACKUP_DIR=backups"
set "DB_FILE=hyperviseur.sqlite"

:: Création du dossier de backup s'il n'existe pas
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Génération du timestamp (Format: YYYY-MM-DD_HH-MM)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%"

:: Copie du fichier
set "DEST_FILE=%BACKUP_DIR%\%DB_FILE%_%TIMESTAMP%.bak"

echo Sauvegarde de %DB_FILE% vers %DEST_FILE%...
copy "%SOURCE_DIR%\%DB_FILE%" "%DEST_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Sauvegarde reussie.
) else (
    echo [ERREUR] Echec de la sauvegarde.
)

:: Optionnel : Supprimer les backups de plus de 30 jours (à activer si besoin)
:: forfiles /p "%BACKUP_DIR%" /s /m *.* /D -30 /C "cmd /c del @path"

endlocal
timeout /t 5
