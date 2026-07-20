-- Database: monitoreo_docente

-- Extension for UUIDs if needed (optional)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

INSERT INTO roles (nombre, descripcion) VALUES 
('administrador', 'Acceso total al sistema'),
('director', 'Gestión de su propia institución'),
('especialista', 'Realiza monitoreos a docentes'),
('docente', 'Usuario monitoreado');

-- Table: instituciones
CREATE TABLE instituciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo_modular VARCHAR(20) UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dni VARCHAR(8) UNIQUE NOT NULL,
    institucion_id INTEGER REFERENCES instituciones(id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: usuario_roles
CREATE TABLE usuario_roles (
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, role_id)
);

-- Table: docentes
CREATE TABLE docentes (
    id SERIAL PRIMARY KEY,
    dni VARCHAR(8) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    especialidad VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    institucion_id INTEGER REFERENCES instituciones(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: periodos (Lectivos)
CREATE TABLE periodos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL, -- e.g., 2024, 2025
    fecha_inicio DATE,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT TRUE
);

-- Table: fichas (Formularios de monitoreo)
CREATE TABLE fichas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    version VARCHAR(10),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: categorias (Dimensiones de la ficha)
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER REFERENCES fichas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    orden INTEGER DEFAULT 0,
    peso DECIMAL(5,2) DEFAULT 0 -- Para cálculos de puntaje
);

-- Table: preguntas
CREATE TABLE preguntas (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    enunciado TEXT NOT NULL,
    orden INTEGER DEFAULT 0,
    tipo VARCHAR(50) DEFAULT 'seleccion_unica' -- seleccion_unica, texto, etc.
);

-- Table: opciones_respuesta
CREATE TABLE opciones_respuesta (
    id SERIAL PRIMARY KEY,
    pregunta_id INTEGER REFERENCES preguntas(id) ON DELETE CASCADE,
    texto VARCHAR(255) NOT NULL,
    valor DECIMAL(5,2) NOT NULL, -- El puntaje que otorga esta opción
    orden INTEGER DEFAULT 0
);

-- Table: niveles_desempeno
CREATE TABLE niveles_desempeno (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER REFERENCES fichas(id) ON DELETE CASCADE,
    nombre VARCHAR(50) NOT NULL, -- e.g., Destacado, Previsto, En Proceso, Inicio
    rango_min DECIMAL(5,2) NOT NULL,
    rango_max DECIMAL(5,2) NOT NULL,
    color VARCHAR(20) -- Hex code for charts
);

-- Table: monitoreos
CREATE TABLE monitoreos (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER REFERENCES fichas(id),
    docente_id INTEGER REFERENCES docentes(id),
    usuario_id INTEGER REFERENCES usuarios(id), -- El especialista que monitorea
    periodo_id INTEGER REFERENCES periodos(id),
    fecha DATE DEFAULT CURRENT_DATE,
    hora_inicio TIME,
    hora_fin TIME,
    puntaje_total DECIMAL(10,2) DEFAULT 0,
    nivel_desempeno_id INTEGER REFERENCES niveles_desempeno(id),
    observaciones TEXT,
    compromisos TEXT,
    estado VARCHAR(20) DEFAULT 'completado', -- borrador, completado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: respuestas
CREATE TABLE respuestas (
    id SERIAL PRIMARY KEY,
    monitoreo_id INTEGER REFERENCES monitoreos(id) ON DELETE CASCADE,
    pregunta_id INTEGER REFERENCES preguntas(id),
    opcion_id INTEGER REFERENCES opciones_respuesta(id),
    respuesta_texto TEXT, -- Para preguntas abiertas
    valor_obtenido DECIMAL(5,2) DEFAULT 0
);


-- Table: password_resets
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL,
    expiracion TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE
);
CREATE TABLE evidencias (
    id SERIAL PRIMARY KEY,
    monitoreo_id INTEGER REFERENCES monitoreos(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo TEXT NOT NULL,
    tipo_archivo VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================
-- NUEVO MÓDULO: REGISTRAR ASISTENCIA DOCENTE
-- ======================================================================

-- Table: configuracion_asistencia
CREATE TABLE configuracion_asistencia (
    id_config SERIAL PRIMARY KEY,
    id_institucion INTEGER REFERENCES instituciones(id) ON DELETE CASCADE,
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

-- Table: asistencias_docentes
CREATE TABLE asistencias_docentes (
    id_asistencia SERIAL PRIMARY KEY,
    id_docente INTEGER REFERENCES docentes(id) ON DELETE CASCADE,
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
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_docente, fecha) -- Un registro por docente por día
);

-- ======================================================================
-- NUEVO MÓDULO: EVENTOS INSTITUCIONALES
-- ======================================================================

-- Table: eventos
CREATE TABLE eventos (
    id_evento SERIAL PRIMARY KEY,
    id_institucion INTEGER NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
    nombre_evento VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, EN_REGISTRO, CERRADO, ANULADO
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: asistencia_eventos
CREATE TABLE asistencia_eventos (
    id_asistencia_evento BIGSERIAL PRIMARY KEY,
    id_evento INTEGER NOT NULL REFERENCES eventos(id_evento) ON DELETE CASCADE,
    id_docente INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
    hora_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    distancia_metros DECIMAL(8,2),
    wifi_detectado VARCHAR(100),
    wifi_bssid VARCHAR(100),
    nivel_seguridad VARCHAR(20), -- ALTA, MEDIA, BAJA
    estado VARCHAR(20) DEFAULT 'PRESENTE',
    observaciones TEXT,
    UNIQUE(id_evento, id_docente) -- Un docente solo puede registrarse una vez por evento
);
