const { Pool } = require('pg');
require('dotenv').config();

// Create a pool instance
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'studyhub',
  max: 20,           // maximum connections
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000 // 2 seconds
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection error', err.stack);
  } else {
    console.log('PostgreSQL connected');
    release();
  }
});

module.exports = pool;