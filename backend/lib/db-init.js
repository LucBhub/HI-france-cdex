const knex = require("../db/knex");
const bcrypt = require("bcryptjs");

/**
 * Initializes the database: runs migrations and seeds default data.
 */
async function initDb() {
  try {
    console.log("[DB] Checking if database is initialized...");

    // --- SELF-HEALING LOGIC START ---
    try {
      // Try connecting with configured credentials
      await knex.raw("SELECT 1");
    } catch (initialError) {
      // If authentication failed (28P01), try to fix it using "postgres" superuser
      if (initialError.code === "28P01") {
        console.warn(
          '[DB] Authentication failed with configured user. Attempting self-healing with "postgres" user...',
        );

        const { Client } = require("pg");

        // Potential passwords for "postgres" user (default or env)
        const fallbackPasswords = [
          process.env.DB_PASS, // Try same password as config
          "postgres", // Default docker
          process.env.POSTGRES_PASSWORD, // Env var if present
        ].filter(Boolean); // Remove undefined/null

        let healed = false;

        for (const pass of [...new Set(fallbackPasswords)]) {
          // Deduplicate
          try {
            console.log(
              `[DB] Trying to connect as postgres with password: ${pass.substring(0, 3)}***`,
            );
            const client = new Client({
              user: "postgres",
              password: pass,
              host: process.env.DB_HOST,
              database: "postgres", // Connect to default DB first to manage roles
              port: process.env.DB_PORT || 5432,
            });

            await client.connect();
            console.log(
              "[DB] Connected as postgres! Creating missing user/role...",
            );

            const targetUser = process.env.DB_USER || "hyperviseur";
            const targetPass = process.env.DB_PASS || "postgres";
            const targetDb = process.env.DB_NAME || "hyperviseur";

            // Check if user exists
            const userCheck = await client.query(
              `SELECT 1 FROM pg_roles WHERE rolname=$1`,
              [targetUser],
            );
            if (userCheck.rowCount === 0) {
              await client.query(
                `CREATE USER "${targetUser}" WITH PASSWORD '${targetPass}' SUPERUSER;`,
              );
              console.log(`[DB] User "${targetUser}" created.`);
            } else {
              await client.query(
                `ALTER USER "${targetUser}" WITH PASSWORD '${targetPass}';`,
              );
              console.log(`[DB] User "${targetUser}" password updated.`);
            }

            // Grant privileges on DB
            // First check if DB exists
            const dbCheck = await client.query(
              `SELECT 1 FROM pg_database WHERE datname=$1`,
              [targetDb],
            );
            if (dbCheck.rowCount === 0) {
              await client.query(`CREATE DATABASE "${targetDb}";`);
              console.log(`[DB] Database "${targetDb}" created.`);
            }

            await client.query(
              `GRANT ALL PRIVILEGES ON DATABASE "${targetDb}" TO "${targetUser}";`,
            );
            console.log(`[DB] Privileges granted.`);

            await client.end();
            healed = true;
            break; // Stop trying passwords
          } catch (e) {
            console.warn(
              `[DB] Failed with password ${pass.substring(0, 3)}***: ${e.message}`,
            );
          }
        }

        if (!healed) {
          console.error(
            "[DB] Self-healing failed. Could not connect as postgres with any known password.",
          );
          throw initialError; // Re-throw original error
        } else {
          console.log("[DB] Self-healing successful! Retrying connection...");
          // Re-instantiate knex implies restarting process usually, but here we just retry check
          // Knex pool should auto-reconnect if we query again? Or maybe we need to destroy connection?
          // Let's rely on the fact that if we proceed, the NEXT query will retry.
        }
      } else {
        throw initialError; // Re-throw other errors (network, etc)
      }
    }
    // --- SELF-HEALING LOGIC END ---

    const hasUsersTable = await knex.schema.hasTable("users");

    if (!hasUsersTable) {
      const fs = require("fs");
      const { exec } = require("child_process");
      const path = require("path");
      const backupPath = path.join(__dirname, "../init_backup.dump");

      if (fs.existsSync(backupPath)) {
        console.log(
          "[DB] Database empty and backup found. Starting Zero-Touch Restore...",
        );

        await new Promise((resolve, reject) => {
          // PC_HOST, PC_PORT, PC_USER, PC_PASS provided by env (DB_HOST etc)
          // We must map them to PG env vars
          const env = {
            ...process.env,
            PGHOST: process.env.DB_HOST,
            PGPORT: process.env.DB_PORT || "5432",
            PGUSER: process.env.DB_USER,
            PGPASSWORD: process.env.DB_PASS,
            PGDATABASE: process.env.DB_NAME || "hyperviseur",
          };

          // pg_restore -d dbname --clean --if-exists --no-owner --role=hyperviseur filename
          // Removing --role if we are not superuser might be safer, but let's try standard restore
          const cmd = `pg_restore --clean --if-exists --no-owner --no-privileges -d ${env.PGDATABASE} "${backupPath}"`;

          console.log(`[DB] Executing: pg_restore ...`);
          exec(cmd, { env }, (error, stdout, stderr) => {
            if (error) {
              console.error("[DB] Restore failed:", stderr);
              // We must throw an error if this is a restore so that the node process exits and we don't start with an empty DB on a stateful app
              console.error(
                "[DB] CRITICAL: Postgres restore failed. Aborting DB initialization to prevent data overwrite.",
              );
              reject(new Error("Restore failed."));
            } else {
              console.log("[DB] Restore successful!");
              console.log(stdout);
              resolve();
            }
          });
        });
      } else {
        console.log(
          "[DB] Database empty but no backup file found. Initializing fresh DB.",
        );
      }
    } else {
      console.log("[DB] Database already initialized.");
    }

    console.log("[DB] Checking migration lock status...");
    try {
      const hasLockTable = await knex.schema.hasTable("knex_migrations_lock");
      if (hasLockTable) {
        const lock = await knex("knex_migrations_lock")
          .select("is_locked")
          .first();
        if (lock && lock.is_locked) {
          console.warn(
            "[DB] Migration lock detected (is_locked=1). Force unlocking...",
          );
          await knex.migrate.forceFreeMigrationsLock();
          console.log("[DB] Migration lock cleared successfully.");
        } else {
          console.log("[DB] No migration lock detected.");
        }
      }
    } catch (lockError) {
      console.warn(
        "[DB] Failed to check/unlock migrations (might be first run):",
        lockError.message,
      );
    }

    console.log("[DB] Running migrations...");
    await knex.migrate.latest();
    console.log("[DB] Migrations complete.");

    const { bootstrapSandboxData } = require("./sandbox-bootstrap");
    await bootstrapSandboxData(knex);

    // ... existing superadmin logic ...
    // Check for superadmin
    const adminUsername = process.env.SUPERADMIN_USERNAME || "admin";
    const adminEmail = process.env.SUPERADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.SUPERADMIN_PASSWORD || "admin123";

    const superadmin = await knex("users")
      .where({ role: "superadmin" })
      .first();
    if (!superadmin) {
      console.log(`[DB] Creating default superadmin: ${adminUsername}`);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      await knex("users").insert({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: "superadmin",
      });
      console.log("[DB] Superadmin created.");
    }

    // Reset plant status to offline on startup
    await knex("plants").update({ status: "offline" });
  } catch (error) {
    console.error("[DB] CRITICAL: Initialization failed:", error);
    console.error(
      "[DB] Exiting process (exit 1) to trigger Kubernetes restart...",
    );
    process.exit(1);
  }
}

module.exports = initDb;
