-- Agregar columna correo a la tabla docentes
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS correo VARCHAR(150);
