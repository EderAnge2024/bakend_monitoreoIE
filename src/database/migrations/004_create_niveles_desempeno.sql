-- ==========================================
-- MIGRACIÓN: Crear tabla niveles_desempeno
-- Ejecutar en pgAdmin o psql
-- ==========================================

CREATE TABLE IF NOT EXISTS niveles_desempeno (
    id_nivel    SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    puntaje_minimo INTEGER NOT NULL,
    puntaje_maximo INTEGER NOT NULL,
    descripcion TEXT,
    color       VARCHAR(20) DEFAULT '#6366f1',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Si la tabla ya existía sin la columna color, agrégala:
ALTER TABLE niveles_desempeno 
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#6366f1';

-- Datos iniciales MINEDU (opcional - también puedes agregarlos desde la app)
-- INSERT INTO niveles_desempeno (nombre, puntaje_minimo, puntaje_maximo, descripcion, color) VALUES
-- ('Insatisfactorio', 0,  49,  'El docente no alcanza los criterios básicos de desempeño.', '#ef4444'),
-- ('En Proceso',      50, 69,  'El docente está desarrollando competencias pero necesita acompañamiento.', '#f59e0b'),
-- ('Satisfactorio',   70, 89,  'El docente cumple con los estándares de desempeño esperados.', '#3b82f6'),
-- ('Destacado',       90, 100, 'El docente supera los estándares y sirve como referente pedagógico.', '#10b981')
-- ON CONFLICT DO NOTHING;
