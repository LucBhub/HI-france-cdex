/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // This migration was recreated after being accidentally deleted
  // The changes may have already been applied to the database
  console.log(
    "[Migration] 20251203_update_thytronic_measurements - Migration file restored",
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Nothing to roll back
};
