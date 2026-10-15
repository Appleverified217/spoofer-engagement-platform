const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:secretpassword@localhost:5432/follower_farming',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
