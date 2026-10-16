const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:secretpassword@localhost:5432/follower_farming',
  connectionTimeoutMillis: 2000,
});

let isDbConnected = false;

pool.on('error', () => {
  isDbConnected = false;
});

async function initDb() {
  try {
    const client = await pool.connect();
    isDbConnected = true;
    client.release();
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('PostgreSQL database connected and schema initialized.');
    }
  } catch (err) {
    isDbConnected = false;
    console.log('PostgreSQL database offline. Running server seamlessly in In-Memory mode.');
  }
}
initDb();

module.exports = {
  query: async (text, params) => {
    if (!isDbConnected) {
      throw new Error('DATABASE_OFFLINE');
    }
    return await pool.query(text, params);
  },
  isDbConnected: () => isDbConnected,
  pool,
};
