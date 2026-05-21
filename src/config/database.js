const { Pool } = require('pg');
const config = require('./index');

let poolConfig;

if (process.env.DATABASE_URL) {
  // Limpiamos los query parameters (como ?sslmode=require) para evitar conflictos con el objeto ssl personalizado
  const cleanConnectionString = process.env.DATABASE_URL.split('?')[0];
  poolConfig = {
    connectionString: cleanConnectionString,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  poolConfig = {
    ...config.db
  };
  
  // Cloud databases like Aiven/Render require SSL connection
  if (
    process.env.NODE_ENV === 'production' || 
    (config.db.host && config.db.host !== 'localhost' && config.db.host !== '127.0.0.1')
  ) {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
}

// Única instancia de Pool declarada correctamente
const pool = new Pool(poolConfig);

pool.on('connect', async () => {
  console.log('PostgreSQL database connected successfully');
  // Ensure password_resets table exists with required columns (idempotent)
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS password_resets (
      id BIGSERIAL PRIMARY KEY,
      id_usuario BIGINT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expiracion TIMESTAMP NOT NULL,
      usado BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Ensured password_resets table exists');
    // Ensure id_docente column exists (add if missing)
    const addDocenteColumn = `ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS id_docente BIGINT REFERENCES docentes(id) ON DELETE CASCADE;`;
    await pool.query(addDocenteColumn);
    console.log('Ensured id_docente column exists');
  } catch (e) {
    console.error('Error ensuring password_resets table/column:', e);
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // IMPORTANTE: No llamamos a process.exit(-1) aquí.
  // Las bases de datos en la nube (como Aiven/Render) cierran conexiones inactivas frecuentemente por inactividad.
  // Si matamos el proceso, Render entrará en un bucle infinito de reinicios (crash loop).
  // pg reconectará automáticamente cuando se realicen nuevas consultas.
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
