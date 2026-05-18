-- 001_initial_seeds.sql

-- Insert Roles
INSERT INTO roles (nombre, descripcion) VALUES 
('administrador', 'Acceso total al sistema'),
('director', 'Gestión de su propia institución'),
('especialista', 'Realiza monitoreos a docentes'),
('docente', 'Usuario monitoreado')
ON CONFLICT (nombre) DO NOTHING;

-- Insert a default institution
INSERT INTO instituciones (nombre, codigo_modular, direccion, correo, director) VALUES 
('Institución Educativa Demo', '1234567', 'Calle Principal 123', 'ie_demo@edu.pe', 'Director General')
ON CONFLICT (codigo_modular) DO NOTHING;

-- Insert an admin user (Password: admin123)
-- Hash for admin123 is $2a$10$XmS5A.mX0YI1UfIu9nIu.O9nIu.O9nIu.O9nIu.O9nIu.O9nIu.O (Example, I'll use a real bcrypt hash if possible)
-- For now, let's assume we run a script to create users or I provide the hash.
-- Hash of 'admin123': $2a$10$6R2pYp9v2W8.W5yR9wV9eeH/fI1bI1I1I1I1I1I1I1I1I1I1I1I1 (Dummy hash)

-- Actually, I'll create a script to seed the admin user professionally.
