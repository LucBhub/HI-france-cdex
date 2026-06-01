/**
 * Add status column to relays table
 *
 * The polling service sets relay.status to 'online' or 'offline'
 * but the column was never created in the schema.
 */

exports.up = async function (knex) {
  console.log("Adding status column to relays table...");

  const hasColumn = await knex.schema.hasColumn("relays", "status");

  if (!hasColumn) {
    await knex.schema.table("relays", (table) => {
      table.string("status").defaultTo("offline");
    });
    console.log("✓ Added status column");
  } else {
    console.log("Status column already exists");
  }
};

exports.down = async function (knex) {
  await knex.schema.table("relays", (table) => {
    table.dropColumn("status");
  });
  console.log("Removed status column");
};
