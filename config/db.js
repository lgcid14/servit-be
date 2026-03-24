const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Successfully connected to PostgreSQL at:', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => {
    console.log('[SQL DEBUG] Executing:', text, params || '');
    return pool.query(text, params);
  },
  pool
};
