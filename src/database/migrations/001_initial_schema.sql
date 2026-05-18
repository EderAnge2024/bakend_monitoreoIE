-- =========================================
-- SISTEMA DE MONITOREO DOCENTE
-- ESTRUCTURA DE TABLAS - POSTGRESQL
-- =========================================

-- =========================================
-- TABLA: instituciones
-- =========================================
CREATE TABLE IF NOT EXISTS instituciones (
    id_institucion SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    codigo_modular VARCHAR(20) UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(150),
    director VARCHAR(200),
    ugel VARCHAR(150),
    dre VARCHAR(150),
    estado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- TABLA: usuarios
-- =========================================
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_institucion BIGINT REFERENCES instituciones(id_institucion),
    dni VARCHAR(15) UNIQUE NOT NULL,
    nombres VARCHAR(150) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    telefono VARCHAR(20),
    foto_perfil TEXT,
    ultimo_login TIMESTAMP,
    estado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- TABLA: roles
-- =========================================
CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);

-- =========================================
-- TABLA: usuario_roles
-- =========================================
CREATE TABLE IF NOT EXISTS usuario_roles (
    id_usuario BIGINT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_rol BIGINT REFERENCES roles(id_rol) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_rol)
);

-- =========================================
-- TABLA: docentes
-- =========================================
CREATE TABLE IF NOT EXISTS docentes (
    id_docente SERIAL PRIMARY KEY,
    id_usuario BIGINT REFERENCES usuarios(id_usuario),
    id_institucion BIGINT REFERENCES instituciones(id_institucion),
    dni VARCHAR(15) UNIQUE NOT NULL,
    nombres VARCHAR(150),
    apellidos VARCHAR(150),
    nivel VARCHAR(100),
    grado VARCHAR(50),
    seccion VARCHAR(20),
    area VARCHAR(150),
    cargo VARCHAR(100),
    condicion_laboral VARCHAR(100),
    estado BOOLEAN DEFAULT TRUE
);

-- =========================================
-- TABLA: periodos
-- =========================================
CREATE TABLE IF NOT EXISTS periodos (
    id_periodo SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado BOOLEAN DEFAULT TRUE
);

-- =========================================
-- TABLA: fichas
-- =========================================
CREATE TABLE IF NOT EXISTS fichas (
    id_ficha SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    estado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- TABLA: categorias
-- =========================================
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria SERIAL PRIMARY KEY,
    id_ficha BIGINT REFERENCES fichas(id_ficha) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0
);

-- =========================================
-- TABLA: preguntas
-- =========================================
CREATE TABLE IF NOT EXISTS preguntas (
    id_pregunta SERIAL PRIMARY KEY,
    id_categoria BIGINT REFERENCES categorias(id_categoria) ON DELETE CASCADE,
    pregunta TEXT NOT NULL,
    tipo_respuesta VARCHAR(50) DEFAULT 'seleccion_unica',
    puntaje_maximo NUMERIC(5,2) DEFAULT 0,
    peso NUMERIC(5,2) DEFAULT 0,
    obligatorio BOOLEAN DEFAULT TRUE,
    orden INTEGER DEFAULT 0,
    estado BOOLEAN DEFAULT TRUE
);

-- =========================================
-- TABLA: opciones_respuesta
-- =========================================
CREATE TABLE IF NOT EXISTS opciones_respuesta (
    id_opcion SERIAL PRIMARY KEY,
    id_pregunta BIGINT REFERENCES preguntas(id_pregunta) ON DELETE CASCADE,
    nombre_opcion VARCHAR(150) NOT NULL,
    valor NUMERIC(5,2) NOT NULL,
    orden INTEGER DEFAULT 0
);

-- =========================================
-- TABLA: monitoreos
-- =========================================
CREATE TABLE IF NOT EXISTS monitoreos (
    id_monitoreo SERIAL PRIMARY KEY,
    id_ficha BIGINT REFERENCES fichas(id_ficha),
    id_periodo BIGINT REFERENCES periodos(id_periodo),
    id_docente BIGINT REFERENCES docentes(id_docente),
    id_evaluador BIGINT REFERENCES usuarios(id_usuario),
    numero_visita INTEGER,
    fecha DATE,
    area VARCHAR(150),
    competencia TEXT,
    desempeno TEXT,
    sesion TEXT,
    interpretacion_desempeno TEXT,
    desempeno_priorizado TEXT,
    compromiso_docente TEXT,
    observaciones_generales TEXT,
    recomendaciones TEXT,
    puntaje_total NUMERIC(6,2) DEFAULT 0,
    nivel_final VARCHAR(100),
    estado VARCHAR(50) DEFAULT 'en_proceso',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- TABLA: respuestas
-- =========================================
CREATE TABLE IF NOT EXISTS respuestas (
    id_respuesta SERIAL PRIMARY KEY,
    id_monitoreo BIGINT REFERENCES monitoreos(id_monitoreo) ON DELETE CASCADE,
    id_pregunta BIGINT REFERENCES preguntas(id_pregunta),
    id_opcion BIGINT REFERENCES opciones_respuesta(id_opcion),
    respuesta_texto TEXT,
    valor_respuesta NUMERIC(6,2),
    puntaje NUMERIC(6,2),
    comentario TEXT
);

-- =========================================
-- TABLA: niveles_desempeno
-- =========================================
CREATE TABLE IF NOT EXISTS niveles_desempeno (
    id_nivel SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    puntaje_minimo NUMERIC(6,2) NOT NULL,
    puntaje_maximo NUMERIC(6,2) NOT NULL,
    descripcion TEXT
);

-- =========================================
-- TABLA: evidencias
-- =========================================
CREATE TABLE IF NOT EXISTS evidencias (
    id_evidencia SERIAL PRIMARY KEY,
    id_monitoreo BIGINT REFERENCES monitoreos(id_monitoreo) ON DELETE CASCADE,
    archivo TEXT NOT NULL,
    tipo_archivo VARCHAR(50),
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
