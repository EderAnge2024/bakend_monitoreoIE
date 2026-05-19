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

pool.on('connect', () => {
  console.log('PostgreSQL database connected successfully');
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
