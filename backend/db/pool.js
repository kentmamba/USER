const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] WARNING: DATABASE_URL is not set. Copy .env.example to .env and set your Neon connection string.'
  );
}

// Neon requires SSL. `sslmode=require` in the connection string plus this
// rejectUnauthorized:false works for Neon's pooled connection strings without
// needing to vendor a CA certificate.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool;
