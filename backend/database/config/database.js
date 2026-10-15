const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
const databaseSslCa = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim();
if (databaseUrl) {
  let protocol;
  try {
    protocol = new URL(databaseUrl).protocol;
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://. Do not use the Supabase HTTPS project/API URL; use the PostgreSQL connection string from the Supabase Connect dialog.');
  }
}

const useSsl = Boolean(databaseSslCa)
  || process.env.DATABASE_SSL === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false');
const options = {
  dialect: 'postgres',
  logging: false,
  ...(useSsl ? {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
        ...(databaseSslCa ? { ca: databaseSslCa } : {}),
      },
    },
  } : {}),
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