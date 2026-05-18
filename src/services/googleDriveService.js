const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const googleOAuthService = require('./googleOAuthService');

// Helper para limpiar espacios y comillas del ID de la carpeta
const getCleanFolderId = (id) => {
  if (!id) return null;
  const cleaned = id.toString().replace(/['"]/g, '').trim();
  return cleaned || null;
};

// Helper de logueo de depuración exclusivo para desarrollo (NODE_ENV !== 'production')
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

/**
 * Obtiene la instancia del cliente de Google Drive autenticada mediante OAuth2.
 * Si no está conectado u operando en local, retorna null para simulación.
 */
const getDriveInstance = async () => {
  if (process.env.USE_GOOGLE_DRIVE !== 'true') return null;
  try {
    const drive = await googleOAuthService.getAuthenticatedDriveClient();
    if (!drive) {
      debugLog('[Google Drive] Sin cuenta de Google vinculada. Operando en modo simulado para no romper el flujo.');
      return null;
    }
    return drive;
  } catch (error) {
    console.error('[Google Drive] Error al obtener el cliente de Drive autenticado:', error);
    return null;
  }
};

const uploadFile = async (filePath, originalName, mimeType, folderId = null) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    console.log(`[Google Drive Simulado] Archivo ${originalName} estaría subido a la carpeta ${folderId}.`);
    return `simulated_file_id_${Date.now()}`;
  }

  try {
    const cleanFolderId = getCleanFolderId(folderId) || getCleanFolderId(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
    
    debugLog(`[Google Drive DEBUG] Subiendo archivo: "${originalName}"`);
    debugLog(`[Google Drive DEBUG] Carpeta destino resuelta: "${cleanFolderId}" (Original: "${folderId}", Env: "${process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID}")`);

    const fileMetadata = {
      name: originalName,
      parents: cleanFolderId ? [cleanFolderId] : []
    };
    
    if (!cleanFolderId) {
      console.warn('[Google Drive WARNING] ¡No se especificó ninguna carpeta de destino! Subiendo a la raíz del Drive (puede provocar error de cuota).');
    }

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true
    });

    debugLog(`[Google Drive DEBUG] Respuesta de Google Drive - Archivo creado con ID: "${response.data.id}"`);
    return response.data.id;
  } catch (error) {
    console.error('Error subiendo archivo a Drive:', error);
    throw error;
  }
};

const deleteFile = async (fileId) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    console.log(`[Google Drive Simulado] Archivo ${fileId} eliminado.`);
    return true;
  }

  try {
    await drive.files.delete({ 
      fileId,
      supportsAllDrives: true
    });
    return true;
  } catch (error) {
    console.error('Error eliminando archivo de Drive:', error);
    throw error;
  }
};

const getFile = async (fileId) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    console.log(`[Google Drive Simulado] Obteniendo archivo ${fileId}.`);
    return { name: 'simulado.pdf', mimeType: 'application/pdf' };
  }

  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, webContentLink',
      supportsAllDrives: true
    });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo archivo de Drive:', error);
    throw error;
  }
};

const generatePublicUrl = async (fileId) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true
    });

    const result = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink',
      supportsAllDrives: true
    });
    
    return result.data.webViewLink;
  } catch (error) {
    console.error('Error generando URL pública:', error);
    throw error;
  }
};

const createFolder = async (folderName, parentFolderId = null) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    console.log(`[Google Drive Simulado] Creando carpeta "${folderName}" con parent "${parentFolderId}"`);
    return `simulated_folder_id_${Date.now()}`;
  }

  try {
    const cleanParentId = getCleanFolderId(parentFolderId) || getCleanFolderId(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
    
    debugLog(`[Google Drive DEBUG] Creando carpeta: "${folderName}"`);
    debugLog(`[Google Drive DEBUG] Carpeta padre resuelta: "${cleanParentId}" (Original: "${parentFolderId}", Env: "${process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID}")`);

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: cleanParentId ? [cleanParentId] : [],
    };

    if (!cleanParentId) {
      console.warn('[Google Drive WARNING] ¡No se especificó carpeta padre para crear la carpeta! Creando en la raíz del Drive (puede provocar error de cuota).');
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
      supportsAllDrives: true
    });

    debugLog(`[Google Drive DEBUG] Carpeta creada con éxito. ID retornado: "${response.data.id}"`);

    // Compartir la carpeta para lectura pública
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true
      });
      debugLog(`[Google Drive DEBUG] Permisos de lectura pública creados para carpeta: "${response.data.id}"`);
    } catch (permError) {
      console.warn('Advertencia al compartir carpeta:', permError.message);
    }

    return response.data.id;
  } catch (error) {
    console.error('Error creando carpeta en Google Drive:', error);
    throw error;
  }
};

const findFolder = async (folderName, parentFolderId = null) => {
  const drive = await getDriveInstance();
  
  if (!drive) {
    return null;
  }

  try {
    const cleanParentId = getCleanFolderId(parentFolderId) || getCleanFolderId(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
    
    let q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (cleanParentId) {
      q += ` and '${cleanParentId}' in parents`;
    }
    
    debugLog(`[Google Drive DEBUG] Buscando carpeta: "${folderName}" dentro de "${cleanParentId}"`);

    const response = await drive.files.list({
      q: q,
      spaces: 'drive',
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (response.data.files && response.data.files.length > 0) {
      debugLog(`[Google Drive DEBUG] Carpeta encontrada. ID: "${response.data.files[0].id}"`);
      return response.data.files[0].id;
    }
    
    debugLog(`[Google Drive DEBUG] Carpeta "${folderName}" no encontrada.`);
    return null;
  } catch (error) {
    console.error('Error buscando carpeta en Google Drive:', error);
    return null;
  }
};

const getOrCreateFolder = async (folderName, parentFolderId = null) => {
  const existingId = await findFolder(folderName, parentFolderId);
  if (existingId) return existingId;
  return await createFolder(folderName, parentFolderId);
};

module.exports = {
  uploadFile,
  deleteFile,
  getFile,
  generatePublicUrl,
  createFolder,
  findFolder,
  getOrCreateFolder
};
