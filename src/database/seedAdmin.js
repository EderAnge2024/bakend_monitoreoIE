const db = require('../config/database');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    console.log('--- Starting Seeding Process ---');

    // 1. Roles
    await db.query(`
      INSERT INTO roles (id_rol, nombre, descripcion) VALUES 
      (1, 'administrador', 'Acceso total al sistema'),
      (2, 'director', 'Gestión de su propia institución'),
      (3, 'especialista', 'Realiza monitoreos a docentes'),
      (4, 'docente', 'Usuario monitoreado')
      ON CONFLICT (id_rol) DO UPDATE SET nombre = EXCLUDED.nombre
    `);
    console.log('Roles seeded.');

    // 2. Default Institution
    const instRes = await db.query(`
      INSERT INTO instituciones (nombre, codigo_modular, direccion, correo, director) VALUES 
      ('Institución Educativa Demo', '1234567', 'Calle Principal 123', 'ie_demo@edu.pe', 'Director General')
      ON CONFLICT (codigo_modular) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id_institucion
    `);
    
    const id_institucion = instRes.rows[0].id_institucion;
    console.log('Institution seeded.');

    const passHash = await bcrypt.hash('admin123', 10);
    const directorHash = await bcrypt.hash('director123', 10);
    const especialistaHash = await bcrypt.hash('especialista123', 10);
    const docenteHash = await bcrypt.hash('docente123', 10);

    const users = [
      { dni: '12345678', nombres: 'Admin', apellidos: 'Sistema', correo: 'admin@sistema.pe', pass: passHash, rolId: 1 },
      { dni: '11111111', nombres: 'Carlos', apellidos: 'Director', correo: 'director@demo.pe', pass: directorHash, rolId: 2 },
      { dni: '22222222', nombres: 'Elena', apellidos: 'Especialista', correo: 'especialista@demo.pe', pass: especialistaHash, rolId: 3 },
      { dni: '33333333', nombres: 'Juan', apellidos: 'Docente', correo: 'docente@demo.pe', pass: docenteHash, rolId: 4 },
    ];

    for (const u of users) {
      const userRes = await db.query(`
        INSERT INTO usuarios (dni, nombres, apellidos, correo, password, id_institucion) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        ON CONFLICT (dni) DO UPDATE SET password = EXCLUDED.password
        RETURNING id_usuario
      `, [u.dni, u.nombres, u.apellidos, u.correo, u.pass, id_institucion]);

      const id_usuario = userRes.rows[0].id_usuario;
      
      await db.query(`
        INSERT INTO usuario_roles (id_usuario, id_rol) 
        VALUES ($1, $2) 
        ON CONFLICT DO NOTHING
      `, [id_usuario, u.rolId]);
      
      console.log(`User seeded: ${u.nombres} (DNI: ${u.dni}, Pass: same as role name + 123)`);
    }

    // Seed a sample Teacher record in 'docentes' table for tests
    await db.query(`
      INSERT INTO docentes (dni, nombres, apellidos, nivel, area, id_institucion)
      VALUES ('33333333', 'Juan', 'Docente', 'Secundaria', 'Matemática', $1)
      ON CONFLICT (dni) DO NOTHING
    `, [id_institucion]);

    console.log('--- Seeding Completed Successfully ---');

  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    process.exit();
  }
};

seedAdmin();
