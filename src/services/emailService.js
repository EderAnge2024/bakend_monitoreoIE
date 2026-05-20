const nodemailer = require('nodemailer');

/**
 * Servicio preparado para la futura integración con Gmail Institucional.
 */

let transporter = null;

const initializeTransporter = () => {
  if (transporter) return transporter;

  // Trim possible whitespace that may appear in env variables
  const rawUser = process.env.GMAIL_USER || '';
  const rawPass = process.env.GOOGLE_APP_PASSWORD || '';
  const user = rawUser.trim();
  const pass = rawPass.trim();

  if (user && pass) {
    // Use SSL (port 465) for Gmail SMTP
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // use SSL/TLS from the start
      auth: { user, pass },
      family: 4, // force IPv4
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    console.log('Servicio de Email inicializado con configuración SSL (puerto 465).');
  } else {
    console.log('Credenciales de Gmail no encontradas o vacías. Las funciones de correo están en modo simulado.');
  }

  return transporter;
};

const sendEmail = async (to, subject, text, html) => {
  const mailer = initializeTransporter();

  if (!mailer) {
    console.log(`[Email Simulado] Enviando correo a: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Contenido: ${text}`);
    return true;
  }

  try {
    const info = await mailer.sendMail({
      from: `"Sistema de Monitoreo IE" <${process.env.GMAIL_USER.trim()}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Correo enviado, messageId:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error enviando correo:', error);
    throw error;
  }
};

const enviarRecuperacionPassword = async (email, resetLink) => {
  const subject = 'Recuperación de Contraseña - Monitoreo IE';
  const text = `Hola, has solicitado recuperar tu contraseña. Por favor, visita el siguiente enlace para crear una nueva: ${resetLink}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
      <p>Hola, has solicitado recuperar tu contraseña en el Sistema de Monitoreo IE.</p>
      <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
      <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer Contraseña</a>
      <p style="margin-top: 20px; font-size: 12px; color: #64748b;">Si no solicitaste esto, puedes ignorar este correo.</p>
    </div>
  `;
  
  return sendEmail(email, subject, text, html);
};

const enviarNotificacionSolicitud = async (emailAdmin, asunto, docenteNombre) => {
  const subject = 'Nueva Solicitud Registrada';
  const text = `El docente ${docenteNombre} ha registrado una nueva solicitud: ${asunto}. Revísela en el sistema.`;
  const html = `<p>El docente <strong>${docenteNombre}</strong> ha registrado una nueva solicitud: <strong>${asunto}</strong>. Por favor, ingrese al sistema para evaluarla.</p>`;
  
  return sendEmail(emailAdmin, subject, text, html);
};

const enviarEstadoSolicitud = async (emailDocente, asunto, estado, observacion) => {
  const subject = `Actualización de Solicitud: ${estado}`;
  const text = `Tu solicitud "${asunto}" ha sido marcada como: ${estado}. Observación: ${observacion || 'Ninguna'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #2563eb;">Actualización de Solicitud</h2>
      <p>Tu solicitud <strong>"${asunto}"</strong> ha sido evaluada.</p>
      <p><strong>Estado:</strong> ${estado}</p>
      <p><strong>Observación de Dirección:</strong> ${observacion || 'Ninguna'}</p>
      <p>Ingresa al sistema para más detalles.</p>
    </div>
  `;
  
  return sendEmail(emailDocente, subject, text, html);
};

module.exports = {
  sendEmail,
  enviarRecuperacionPassword,
  enviarNotificacionSolicitud,
  enviarEstadoSolicitud
};
