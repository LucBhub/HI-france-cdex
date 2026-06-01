exports.up = function (knex) {
  return knex.schema.table("plants", function (table) {
    table.float("voltageL1").nullable();
    table.float("voltageL2").nullable();
    table.float("voltageL3").nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.table("plants", function (table) {
    table.dropColumn("voltageL1");
    table.dropColumn("voltageL2");
    table.dropColumn("voltageL3");
  });
};
