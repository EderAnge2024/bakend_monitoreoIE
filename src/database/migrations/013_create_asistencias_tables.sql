-- Migración 013: Crear tablas de asistencias y configuración
-- Fecha: 2026-07-20
-- Descripción: Agregar módulo de registro de asistencia docente

-- Tabla: configuracion_asistencia
CREATE TABLE IF NOT EXISTS configuracion_asistencia (
    id_config SERIAL PRIMARY KEY,
    id_institucion INTEGER REFERENCES instituciones(id_institucion) ON DELETE CASCADE,
    latitud_ie DECIMAL(10,8) NOT NULL,
    longitud_ie DECIMAL(10,8) NOT NULL,
    radio_permitido_metros INTEGER DEFAULT 100,
    wifi_nombre VARCHAR(255),
    wifi_bssid VARCHAR(17), -- MAC address format
    validar_gps BOOLEAN DEFAULT TRUE,
    validar_wifi BOOLEAN DEFAULT FALSE,
    hora_ingreso TIME DEFAULT '08:00:00',
    hora_salida TIME DEFAULT '13:00:00',
    tolerancia_minutos INTEGER DEFAULT 15,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: asistencias_docentes
CREATE TABLE IF NOT EXISTS asistencias_docentes (
    id_asistencia SERIAL PRIMARY KEY,
    id_docente INTEGER REFERENCES docentes(id_docente) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_ingreso TIME,
    hora_salida TIME,
    latitud_ingreso DECIMAL(10,8),
    longitud_ingreso DECIMAL(10,8),
    latitud_salida DECIMAL(10,8),
    longitud_salida DECIMAL(10,8),
    distancia_ingreso_metros INTEGER,
    distancia_salida_metros INTEGER,
    wifi_ingreso VARCHAR(255),
    wifi_ingreso_bssid VARCHAR(17),
    wifi_salida VARCHAR(255),
    wifi_salida_bssid VARCHAR(17),
    estado_ingreso VARCHAR(20) DEFAULT 'PUNTUAL', -- PUNTUAL, TARDANZA
    estado_salida VARCHAR(20), -- NORMAL, TEMPRANO
    nivel_seguridad VARCHAR(20) DEFAULT 'MEDIA', -- ALTA, MEDIA, BAJA
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear constraint único para evitar duplicados por día
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'asistencias_docentes_id_docente_fecha_key'
    ) THEN
        ALTER TABLE asistencias_docentes 
        ADD CONSTRAINT asistencias_docentes_id_docente_fecha_key 
        UNIQUE(id_docente, fecha);
    END IF;
END $$;