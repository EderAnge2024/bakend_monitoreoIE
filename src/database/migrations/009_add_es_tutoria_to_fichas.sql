-- Agregar columna es_tutoria a la tabla fichas
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS es_tutoria BOOLEAN DEFAULT FALSE;
