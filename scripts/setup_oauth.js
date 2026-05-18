const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function setupOAuthTable() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando creación de tabla de tokens de Google OAuth ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS google_oauth_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date BIGINT,
        token_type VARCHAR(100),
        scope TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ ÉXITO: Se creó la tabla google_oauth_tokens correctamente.');
  } catch (err) {
    console.error('❌ ERROR al inicializar la tabla de OAuth:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupOAuthTable();
