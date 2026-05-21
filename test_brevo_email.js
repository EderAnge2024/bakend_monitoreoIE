// test_brevo_email.js
require('dotenv').config();
const { sendEmail } = require('./src/services/brevo.service');

(async () => {
  try {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Prueba Brevo',
      text: 'Este es un email de prueba.',
      html: '<p>Este es un <strong>email</strong> de prueba.</p>',
    });
    console.log('Resultado:', result);
  } catch (e) {
    console.error('Error de envío:', e);
  }
})();
