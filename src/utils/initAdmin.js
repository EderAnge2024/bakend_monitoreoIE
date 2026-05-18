const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const initializeAdmin = async () => {
  try {
    // Roles por defecto
    const defaultRoles = [
      { nombre: 'administrador', descripcion: 'Acceso total al sistema' },
      { nombre: 'director', descripcion: 'Gestión de su propia institución' },
      { nombre: 'especialista', descripcion: 'Realiza monitoreos a docentes' },
      { nombre: 'docente', descripcion: 'Usuario monitoreado' }
    ];

    let idRolAdmin = null;

    for (const rol of defaultRoles) {
      let rolRes = await db.query("SELECT id_rol FROM roles WHERE nombre = $1", [rol.nombre]);
      
      if (rolRes.rows.length === 0) {
        rolRes = await db.query(
          "INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id_rol", 
          [rol.nombre, rol.descripcion]
        );
      }

      if (rol.nombre === 'administrador') {
        idRolAdmin = rolRes.rows[0].id_rol;
      }
    }

    // Verificar si existe al menos un usuario administrador
    const adminExists = await db.query(`
      SELECT u.id_usuario 
      FROM usuarios u 
      JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario 
      WHERE ur.id_rol = $1
    `, [idRolAdmin]);

    if (adminExists.rows.length === 0) {
      console.log('----------------------------------------------------');
      console.log('⚙️ Inicializando el sistema...');
      console.log('No se encontraron administradores. Creando superadmin automático...');

      const randomString = crypto.randomBytes(4).toString('hex');
      const dni = `admin_${randomString.substring(0, 4)}`; // Un DNI ficticio para poder logearse
      const passwordPlain = crypto.randomBytes(6).toString('hex');
      const hashedPassword = await bcrypt.hash(passwordPlain, 10);
      const correo = `superadmin_${randomString}@institucion.edu.pe`;

      const userRes = await db.query(
        `INSERT INTO usuarios (dni, nombres, apellidos, correo, password) 
         VALUES ($1, 'Super', 'Admin', $2, $3) RETURNING id_usuario`,
        [dni, correo, hashedPassword]
      );
      
      const idUsuario = userRes.rows[0].id_usuario;

      await db.query(
        'INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)',
        [idUsuario, idRolAdmin]
      );

      console.log('✅ Superadmin creado exitosamente.');
      console.log('----------------------------------------------------');
      console.log('🔑 CREDENCIALES DE ACCESO:');
      console.log(`👤 DNI (Usuario): ${dni}`);
      console.log(`🔐 Contraseña: ${passwordPlain}`);
      console.log(`✉️ Correo: ${correo}`);
      console.log('----------------------------------------------------');
      console.log('⚠️ IMPORTANTE: Copia estas credenciales. Se recomienda cambiar la contraseña o crear tu propio usuario después del primer ingreso.');
    }
  } catch (error) {
    console.error('Error inicializando el administrador:', error);
  }
};

module.exports = initializeAdmin;
