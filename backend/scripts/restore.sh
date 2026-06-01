#!/bin/sh
set -e

# Usage: ./restore.sh <backup_filename>
# Example: ./restore.sh hyperviseur_backup_2026-01-21_09-00-00.dump

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_filename>"
    echo "Available backups:"
    ls -lh /backups/*.dump
    exit 1
fi

FULL_PATH="/backups/$BACKUP_FILE"
# Check if file exists (handle both full path or relative filename)
if [ ! -f "$FULL_PATH" ]; then
    if [ -f "$BACKUP_FILE" ]; then
        FULL_PATH="$BACKUP_FILE"
    else
        echo "Error: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "[Restore] WARNING: This will OVERWRITE the database '$DB_NAME'."
echo "[Restore] Restoring from $FULL_PATH..."

# Check if pg_restore is available
if ! command -v pg_restore > /dev/null; then
    echo "[Restore] Error: pg_restore not found in container."
    exit 1
fi

# Restore
# -h: Host
# -p: Port
# -U: User
# -d: Database
# -c: Clean (drop objects before creating)
# -v: Verbose
export PGPASSWORD="$DB_PASS"
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -v "$FULL_PATH"

echo "[Restore] Restoration complete!"
