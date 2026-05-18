const { google } = require('googleapis');
const db = require('../config/database');

let oauth2ClientInstance = null;

const getOAuth2Client = () => {
  if (oauth2ClientInstance) return oauth2ClientInstance;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn('[Google OAuth] Faltan variables de entorno GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI. El servicio de autenticación no funcionará correctamente.');
    return null;
  }

  oauth2ClientInstance = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2ClientInstance;
};

/**
 * Genera la URL de autorización para el inicio de sesión del Administrador con Google
 */
const getAuthUrl = () => {
  const client = getOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline', // Imprescindible para obtener el refresh_token
    prompt: 'consent',     // Obliga a Google a mostrar la pantalla de consentimiento para asegurar el refresh_token
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
};

/**
 * Intercambia el código de autorización por los tokens de acceso y los guarda en la base de datos
 */
const handleCallback = async (code) => {
  const client = getOAuth2Client();
  if (!client) throw new Error('Cliente OAuth2 no configurado');

  const { tokens } = await client.getToken(code);
  
  // Guardar en la base de datos
  await db.query('DELETE FROM google_oauth_tokens'); // Limpiar tokens anteriores
  await db.query(
    `INSERT INTO google_oauth_tokens (access_token, refresh_token, expiry_date, token_type, scope)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      tokens.access_token,
      tokens.refresh_token || null, // A veces Google no retorna refresh_token si ya se autorizó antes, por eso prompt: consent es vital
      tokens.expiry_date || null,
      tokens.token_type || null,
      tokens.scope || null
    ]
  );

  console.log('✅ Google OAuth: Tokens guardados correctamente en la base de datos.');
  return tokens;
};

/**
 * Obtiene el token guardado en la base de datos
 */
const getStoredToken = async () => {
  const result = await db.query('SELECT * FROM google_oauth_tokens ORDER BY id DESC LIMIT 1');
  if (result.rows.length === 0) return null;
  return result.rows[0];
};

/**
 * Verifica si el sistema está conectado a Google Drive a través de OAuth2
 */
const isConnected = async () => {
  const token = await getStoredToken();
  return !!token;
};

/**
 * Elimina la conexión con Google Drive
 */
const disconnect = async () => {
  await db.query('DELETE FROM google_oauth_tokens');
  console.log('🔌 Google OAuth: Conexión eliminada correctamente.');
  return true;
};

/**
 * Retorna un cliente de Google Drive autenticado con el token guardado
 */
const getAuthenticatedDriveClient = async () => {
  const client = getOAuth2Client();
  if (!client) return null;

  const storedToken = await getStoredToken();
  if (!storedToken) {
    return null;
  }

  // Establecer credenciales
  client.setCredentials({
    access_token: storedToken.access_token,
    refresh_token: storedToken.refresh_token,
    expiry_date: parseInt(storedToken.expiry_date),
    token_type: storedToken.token_type,
    scope: storedToken.scope
  });

  // Suscribirse al evento de refresco de tokens para guardarlos automáticamente cuando caduquen
  client.on('tokens', async (newTokens) => {
    try {
      console.log('🔄 Google OAuth: Detectado refresco de tokens, actualizando en la base de datos...');
      const stored = await getStoredToken();
      if (stored) {
        const updatedAccessToken = newTokens.access_token || stored.access_token;
        const updatedRefreshToken = newTokens.refresh_token || stored.refresh_token;
        const updatedExpiryDate = newTokens.expiry_date || stored.expiry_date;

        await db.query(
          `UPDATE google_oauth_tokens 
           SET access_token = $1, refresh_token = $2, expiry_date = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [updatedAccessToken, updatedRefreshToken, updatedExpiryDate, stored.id]
        );
        console.log('🔄 Google OAuth: Tokens actualizados en BD.');
      }
    } catch (err) {
      console.error('❌ Error al actualizar tokens refrescados en base de datos:', err);
    }
  });

  return google.drive({ version: 'v3', auth: client });
};

module.exports = {
  getAuthUrl,
  handleCallback,
  isConnected,
  disconnect,
  getStoredToken,
  getAuthenticatedDriveClient
};
