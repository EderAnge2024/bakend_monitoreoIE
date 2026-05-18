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

async function setupDocumentsSchema() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando creación de tablas de Gestión Documental ---');
    await client.query('BEGIN');

    // 1. Crear tabla de estados_documentos
    console.log('Creando tabla estados_documentos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS estados_documentos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(20)
      )
    `);

    // Insertar los estados requeridos
    console.log('Insertando estados por defecto...');
    await client.query(`
      INSERT INTO estados_documentos (nombre, color) VALUES
      ('En espera', '#94a3b8'),
      ('Recibido', '#3b82f6'),
      ('Observado', '#f59e0b'),
      ('Aprobado', '#10b981'),
      ('Rechazado', '#ef4444')
      ON CONFLICT (nombre) DO NOTHING
    `);

    // 2. Crear tabla de categorias_documentos
    console.log('Creando tabla categorias_documentos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias_documentos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        descripcion TEXT,
        drive_folder_id_templates VARCHAR(255),
        drive_folder_id_users VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Crear tabla de plantillas
    console.log('Creando tabla plantillas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS plantillas (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER REFERENCES categorias_documentos(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        drive_file_id VARCHAR(255) NOT NULL,
        drive_file_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Crear tabla de documentos_subidos
    console.log('Creando tabla documentos_subidos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS documentos_subidos (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER REFERENCES categorias_documentos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        drive_file_id VARCHAR(255) NOT NULL,
        drive_file_url TEXT NOT NULL,
        estado VARCHAR(50) DEFAULT 'En espera',
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('✅ ÉXITO: Se crearon todas las tablas de gestión documental correctamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR al inicializar la base de datos:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDocumentsSchema();
