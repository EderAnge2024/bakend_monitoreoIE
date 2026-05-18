-- =========================================
-- MIGRATION: 005 - Tutorias, FUTs y Solicitudes
-- =========================================

-- 1. ACTUALIZAR TABLA DOCENTES
ALTER TABLE docentes
ADD COLUMN IF NOT EXISTS tutor BOOLEAN DEFAULT FALSE;

ALTER TABLE docentes
ADD COLUMN IF NOT EXISTS grado_tutoria VARCHAR(50);

-- 2. ACTUALIZAR TABLA MONITOREOS
ALTER TABLE monitoreos
ADD COLUMN IF NOT EXISTS tipo_monitoreo VARCHAR(50);

-- 3. CREAR TABLA FUTS
CREATE TABLE IF NOT EXISTS futs (
    id_fut BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(200),
    descripcion TEXT,
    archivo_url TEXT,
    estado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. CREAR TABLA SOLICITUDES
CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud BIGSERIAL PRIMARY KEY,
    id_docente BIGINT REFERENCES docentes(id_docente),
    id_fut BIGINT REFERENCES futs(id_fut),
    tipo_solicitud VARCHAR(100),
    asunto VARCHAR(250),
    descripcion TEXT,
    archivo_adjunto TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    observacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
