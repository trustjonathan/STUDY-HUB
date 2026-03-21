const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,      // your database name
  process.env.DB_USER,      // your DB username
  process.env.DB_PASS,      // your DB password
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false,         // optional, disables SQL logging
  }
);

module.exports = sequelize;