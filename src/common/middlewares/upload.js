const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const futsDir = path.join(__dirname, '../../../uploads/futs');
const solicitudesDir = path.join(__dirname, '../../../uploads/solicitudes');

if (!fs.existsSync(futsDir)) {
  fs.mkdirSync(futsDir, { recursive: true });
}
if (!fs.existsSync(solicitudesDir)) {
  fs.mkdirSync(solicitudesDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.originalUrl.includes('futs')) {
      cb(null, futsDir);
    } else if (req.originalUrl.includes('solicitudes')) {
      cb(null, solicitudesDir);
    } else {
      cb(null, path.join(__dirname, '../../../uploads'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (PDF, DOCX, XLSX, Images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no válido. Solo se permiten PDF, DOCX, XLSX e Imágenes.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

module.exports = upload;
