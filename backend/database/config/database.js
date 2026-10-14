const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
const useSsl = process.env.DATABASE_SSL === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false');
const options = {
  dialect: 'postgres',
  logging: false,
  ...(useSsl ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: true } } } : {}),
};

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, options)
  : new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      ...options,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
    }
  );

module.exports = sequelize;