const knex = require("knex");
const config = require("../knexfile");

// For now, we'll just use the development environment
// In a real production setup, you might use process.env.NODE_ENV to switch configurations
const environment = process.env.NODE_ENV || "development";
module.exports = knex(config[environment]);
