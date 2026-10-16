const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:secretpassword@localhost:5432/follower_farming',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Automatically initialize schema tables on startup
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Database schema initialized successfully.');
    }
  } catch (err) {
    console.warn('Could not auto-initialize database schema (Database might not be connected yet):', err.message);
  }
}
initDb();

module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error(`Database Query Error (${err.message}):`, text);
      throw err;
    }
  },
  pool,
};
