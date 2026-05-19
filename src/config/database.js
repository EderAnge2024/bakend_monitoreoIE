const { Pool } = require('pg');
const config = require('./index');

let poolConfig;

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL
  };
} else {
  poolConfig = {
    ...config.db
  };
}

// Cloud databases like Aiven/Render require SSL connection
if (
  process.env.NODE_ENV === 'production' || 
  process.env.DATABASE_URL || 
  (config.db.host && config.db.host !== 'localhost' && config.db.host !== '127.0.0.1')
) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('PostgreSQL database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
