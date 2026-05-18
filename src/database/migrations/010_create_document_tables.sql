-- =========================================
-- TABLAS: Gestión Documental y Google OAuth
-- =========================================

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    token_type VARCHAR(50),
    scope TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias_documentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    drive_folder_id_templates VARCHAR(255),
    drive_folder_id_users VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plantillas (
    id SERIAL PRIMARY KEY,
    categoria_id BIGINT REFERENCES categorias_documentos(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255),
    drive_file_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_subidos (
    id SERIAL PRIMARY KEY,
    categoria_id BIGINT REFERENCES categorias_documentos(id) ON DELETE CASCADE,
    usuario_id BIGINT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255),
    drive_file_url TEXT,
    estado VARCHAR(50) DEFAULT 'En espera',
    observacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
