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
/*
  // --- Ensure password_resets table exists (idempotent) ---
  const createPasswordResets = `
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      id_usuario INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      id_docente INTEGER REFERENCES docentes(id) ON DELETE CASCADE,
      token VARCHAR(64) NOT NULL,
      expiracion TIMESTAMP NOT NULL,
      usado BOOLEAN DEFAULT FALSE
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Ensured password_resets table exists');
  } catch (e) {
    console.error('Error ensuring password_resets table:', e);
  }*/
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
