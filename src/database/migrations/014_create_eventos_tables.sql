-- Migración 014: Crear tablas de eventos institucionales
-- Fecha: 2026-07-20
-- Descripción: Agregar módulo de eventos institucionales y registro de asistencia a eventos

-- Tabla: eventos
CREATE TABLE IF NOT EXISTS eventos (
    id_evento SERIAL PRIMARY KEY,
    id_institucion INTEGER NOT NULL REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
    nombre_evento VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, EN_REGISTRO, CERRADO, ANULADO
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: asistencia_eventos
CREATE TABLE IF NOT EXISTS asistencia_eventos (
    id_asistencia_evento BIGSERIAL PRIMARY KEY,
    id_evento INTEGER NOT NULL REFERENCES eventos(id_evento) ON DELETE CASCADE,
    id_docente INTEGER NOT NULL REFERENCES docentes(id_docente) ON DELETE CASCADE,
    hora_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    distancia_metros DECIMAL(8,2),
    wifi_detectado VARCHAR(100),
    wifi_bssid VARCHAR(100),
    nivel_seguridad VARCHAR(20), -- ALTA, MEDIA, BAJA
    estado VARCHAR(20) DEFAULT 'PRESENTE',
    observaciones TEXT
);

-- Crear constraint único para evitar registros duplicados por evento
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'asistencia_eventos_id_evento_id_docente_key'
    ) THEN
        ALTER TABLE asistencia_eventos 
        ADD CONSTRAINT asistencia_eventos_id_evento_id_docente_key 
        UNIQUE(id_evento, id_docente);
    END IF;
END $$;