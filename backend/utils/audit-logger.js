const knex = require("../db/knex");

/**
 * Log a user action to the audit_logs table.
 *
 * @param {Object} params
 * @param {number|null} params.userId - ID of the user performing the action (null for system)
 * @param {string} params.username - Username at the time of action
 * @param {string} params.action - Action type (e.g., 'RELAY_CONTROL', 'FAULT_ACK')
 * @param {string} params.targetType - Target entity type (e.g., 'RELAY', 'PLANT')
 * @param {string|number} params.targetId - ID of the target
 * @param {Object|string} params.details - Additional details about the action
 * @param {string} params.ipAddress - IP address of the user
 */
async function logAudit({
  userId,
  username,
  action,
  targetType,
  targetId,
  details,
  ipAddress,
}) {
  try {
    const detailsStr =
      typeof details === "object" ? JSON.stringify(details) : details;

    await knex("audit_logs").insert({
      user_id: userId,
      username: username || "Unknown",
      action,
      target_type: targetType,
      target_id: String(targetId),
      details: detailsStr,
      ip_address: ipAddress,
    });

    console.log(`[Audit] Logged: ${action} by ${username}`);
  } catch (error) {
    console.error("[Audit] Failed to write log:", error);
    // Do not throw, so we don't block the main action if logging fails
  }
}

module.exports = { logAudit };
