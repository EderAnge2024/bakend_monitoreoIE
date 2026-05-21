// emailService.js
// Email sending service using Brevo Transactional Email API.
// This replaces the previous Nodemailer + Gmail/SMTP implementation.

const { sendEmail } = require('./brevo.service');

// Helper to construct sender email (fallback to env or placeholder)
const getSenderEmail = () => {
  return process.env.BREVO_SENDER_EMAIL || 'no-reply@monitoreo.ie';
};

/**
 * Generic email sender wrapper.
 * @param {string} to Recipient email address.
 * @param {string} subject Email subject.
 * @param {string} text Plain‑text version.
 * @param {string} html HTML version.
 */
const send = async (to, subject, text, html) => {
  // Use Brevo service; it will simulate if API key missing.
  return sendEmail(to, subject, text, html);
};

/**
 * Send password recovery email with a reset link.
 */
const enviarRecuperacionPassword = async (email, resetLink) => {
  const subject = 'Recuperación de Contraseña - Monitoreo IE';
  const text = `Hola, has solicitado recuperar tu contraseña. Visita el siguiente enlace para crear una nueva: ${resetLink}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
      <p>Hola, has solicitado recuperar tu contraseña en el Sistema de Monitoreo IE.</p>
      <p>Haz clic en el botón siguiente para crear una nueva contraseña:</p>
      <a href="${resetLink}" style="display:inline-block; padding:10px 20px; background-color:#2563eb; color:#fff; text-decoration:none; border-radius:5px; font-weight:bold;">Restablecer Contraseña</a>
      <p style="margin-top:20px; font-size:12px; color:#64748b;">Si no solicitaste esto, puedes ignorar este correo.</p>
    </div>
  `;
  return send(email, subject, text, html);
};

/**
 * Notification for a new request (used elsewhere in the app).
 */
const enviarNotificacionSolicitud = async (emailAdmin, asunto, docenteNombre) => {
  const subject = 'Nueva Solicitud Registrada';
  const text = `El docente ${docenteNombre} ha registrado una nueva solicitud: ${asunto}. Revísela en el sistema.`;
  const html = `<p>El docente <strong>${docenteNombre}</strong> ha registrado una nueva solicitud: <strong>${asunto}</strong>. Por favor, ingrese al sistema para evaluarla.</p>`;
  return send(emailAdmin, subject, text, html);
};

/**
 * Notify teacher about the status of their request.
 */
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
  return send(emailDocente, subject, text, html);
};

module.exports = {
  send,
  enviarRecuperacionPassword,
  enviarNotificacionSolicitud,
  enviarEstadoSolicitud,
};
