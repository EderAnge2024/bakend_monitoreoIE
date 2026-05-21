-- Add id_docente column to password_resets
ALTER TABLE password_resets
ADD COLUMN IF NOT EXISTS id_docente BIGINT REFERENCES docentes(id_docente) ON DELETE CASCADE;
