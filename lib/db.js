const { Pool } = require("pg");

const connectionString =
  process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Database connection string is missing. Set NETLIFY_DATABASE_URL."
  );
}

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

const pool = global._pgPool;

module.exports = { pool };
