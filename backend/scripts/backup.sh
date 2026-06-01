#!/bin/sh
set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="$BACKUP_DIR/hyperviseur_backup_$TIMESTAMP.dump"

echo "[Backup] Starting backup for database '$DB_NAME' at $TIMESTAMP..."

# Check if pg_dump is available
if ! command -v pg_dump > /dev/null; then
    echo "[Backup] Error: pg_dump not found in container."
    exit 1
fi

# Run pg_dump
# -h: Host
# -p: Port
# -U: User
# -d: Database
# -F c: Custom format (compressed, best for pg_restore)
# -f: Output file
export PGPASSWORD="$DB_PASS"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$FILENAME"

echo "[Backup] Backup created successfully: $FILENAME"

# Cleanup old backups (keep last 7 days)
echo "[Backup] Cleaning up old backups (retention: 7 days)..."
find "$BACKUP_DIR" -name "hyperviseur_backup_*.dump" -mtime +7 -exec rm {} \; -print

echo "[Backup] Operation complete."
