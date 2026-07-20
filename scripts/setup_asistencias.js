const db = require('../src/config/database');

/**
 * Script para configurar asistencias por institución
 * Este script debe ser ejecutado por cada institución para configurar los parámetros
 * de asistencia según sus necesidades.
 */

const configurarAsistencia = async () => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🚀 Iniciando configuración de asistencias...');

    // Obtener todas las instituciones
    const instituciones = await client.query('SELECT id_institucion, nombre FROM instituciones');
    
    if (instituciones.rows.length === 0) {
      console.log('❌ No se encontraron instituciones en el sistema');
      return;
    }

    console.log(`📚 Encontradas ${instituciones.rows.length} instituciones`);

    // Configuración por defecto para cada institución
    for (const institucion of instituciones.rows) {
      const { id_institucion, nombre } = institucion;
      
      // Verificar si ya existe configuración
      const existeConfig = await client.query(
        'SELECT id_config FROM configuracion_asistencia WHERE id_institucion = $1',
        [id_institucion]
      );

      if (existeConfig.rows.length > 0) {
        console.log(`⚠️  ${nombre}: Ya tiene configuración de asistencia`);
        continue;
      }

      // Crear configuración por defecto
      const configDefault = {
        latitud_ie: -12.0464,     // Coordenadas de ejemplo (Lima, Perú)
        longitud_ie: -77.0428,
        radio_permitido_metros: 100,
        wifi_nombre: `IE_${nombre.replace(/\s+/g, '_').toUpperCase()}`,
        wifi_bssid: null,
        validar_gps: true,
        validar_wifi: false,      // Deshabilitado por defecto hasta configuración manual
        hora_ingreso: '08:00:00',
        hora_salida: '13:00:00',
        tolerancia_minutos: 15,
        activo: true
      };

      await client.query(
        `INSERT INTO configuracion_asistencia 
         (id_institucion, latitud_ie, longitud_ie, radio_permitido_metros, 
          wifi_nombre, wifi_bssid, validar_gps, validar_wifi, 
          hora_ingreso, hora_salida, tolerancia_minutos, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id_institucion,
          configDefault.latitud_ie,
          configDefault.longitud_ie,
          configDefault.radio_permitido_metros,
          configDefault.wifi_nombre,
          configDefault.wifi_bssid,
          configDefault.validar_gps,
          configDefault.validar_wifi,
          configDefault.hora_ingreso,
          configDefault.hora_salida,
          configDefault.tolerancia_minutos,
          configDefault.activo
        ]
      );

      console.log(`✅ ${nombre}: Configuración creada con valores por defecto`);
    }

    await client.query('COMMIT');
    
    console.log('\n🎉 Configuración de asistencias completada');
    console.log('\n📋 IMPORTANTE:');
    console.log('1. Cada director debe actualizar las coordenadas GPS de su institución');
    console.log('2. Configurar el WiFi institucional si desean validación por red');
    console.log('3. Ajustar horarios según el turno de trabajo');
    console.log('4. Revisar el radio de tolerancia GPS según las instalaciones');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error configurando asistencias:', error.message);
  } finally {
    client.release();
  }
};

// Función para mostrar configuraciones existentes
const mostrarConfiguraciones = async () => {
  try {
    const result = await db.query(`
      SELECT 
        c.*,
        i.nombre as institucion_nombre
      FROM configuracion_asistencia c
      JOIN instituciones i ON c.id_institucion = i.id_institucion
      ORDER BY i.nombre
    `);

    if (result.rows.length === 0) {
      console.log('📋 No hay configuraciones de asistencia creadas');
      return;
    }

    console.log('\n📊 CONFIGURACIONES ACTUALES:');
    console.log('='.repeat(80));
    
    result.rows.forEach(config => {
      console.log(`\n🏫 ${config.institucion_nombre}`);
      console.log(`   📍 GPS: ${config.latitud_ie}, ${config.longitud_ie}`);
      console.log(`   📏 Radio: ${config.radio_permitido_metros}m`);
      console.log(`   📶 WiFi: ${config.wifi_nombre || 'No configurado'}`);
      console.log(`   🔒 Validaciones: GPS=${config.validar_gps}, WiFi=${config.validar_wifi}`);
      console.log(`   🕐 Horario: ${config.hora_ingreso} - ${config.hora_salida}`);
      console.log(`   ⏰ Tolerancia: ${config.tolerancia_minutos} minutos`);
      console.log(`   ✅ Activo: ${config.activo}`);
    });
    
  } catch (error) {
    console.error('❌ Error consultando configuraciones:', error.message);
  }
};

// Ejecutar según argumentos de línea de comandos
const main = async () => {
  const action = process.argv[2];
  
  switch (action) {
    case 'setup':
      await configurarAsistencia();
      break;
    case 'list':
      await mostrarConfiguraciones();
      break;
    default:
      console.log('\n📘 USO DEL SCRIPT:');
      console.log('node setup_asistencias.js setup  - Crear configuraciones por defecto');
      console.log('node setup_asistencias.js list   - Mostrar configuraciones existentes');
      break;
  }
  
  process.exit(0);
};

main().catch(console.error);