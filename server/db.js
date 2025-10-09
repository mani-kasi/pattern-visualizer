const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Please configure it in your environment.');
}

const pool = new Pool({
  connectionString,
});

module.exports = {
  pool,
};