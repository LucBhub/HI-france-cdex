exports.up = function (knex) {
  return knex.schema.table("plants", function (table) {
    table.float("activePower").nullable();
    table.float("reactivePower").nullable();
    table.float("apparentPower").nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.table("plants", function (table) {
    table.dropColumn("activePower");
    table.dropColumn("reactivePower");
    table.dropColumn("apparentPower");
  });
};
