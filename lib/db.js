const { Pool } = require("pg");

function normalizeConnectionString(value) {
  if (!value) return value;
  const url = new URL(value);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && sslmode.toLowerCase() === "require") {
    if (!url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
    }
  }
  return url.toString();
}

const connectionString = normalizeConnectionString(
  process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL
);

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
