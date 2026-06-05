const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { apiRateLimiter } = require('./common/middlewares/rateLimiter');

// Import modular routes
const authRoutes = require('./modules/auth/auth.routes');
const institucionRoutes = require('./modules/instituciones/institucion.routes');
const userRoutes = require('./modules/users/user.routes');
const docenteRoutes = require('./modules/docentes/docente.routes');
const fichaRoutes = require('./modules/fichas/ficha.routes');
const monitoreoRoutes = require('./modules/monitoreos/monitoreo.routes');
const periodoRoutes = require('./modules/periodos/periodo.routes');
const nivelRoutes = require('./modules/niveles/nivel.routes');
const futRoutes = require('./modules/futs/fut.routes');
const solicitudRoutes = require('./modules/solicitudes/solicitud.routes');
const rolesRoutes = require('./modules/roles/roles.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const documentoRoutes = require('./modules/documentos/documento.routes');
const reporteRoutes   = require('./modules/reportes/reporte.routes');


const app = express();
app.set('trust proxy', 1); // Enable trust proxy for X-Forwarded-For (Render/Vercel)

// Middlewares - Morgan primero para registrar absolutamente todas las peticiones
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

app.use(helmet());
app.use(cookieParser());
// Configuración robusta de orígenes permitidos para CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

if (process.env.FRONTEND_URL) {
  // Limpiamos barra inclinada al final por si el usuario la agregó en la configuración de Render
  const cleanOrigin = process.env.FRONTEND_URL.replace(/\/$/, "");
  if (!allowedOrigins.includes(cleanOrigin)) {
    allowedOrigins.push(cleanOrigin);
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como Postman, curl, o tareas internas)
    if (!origin) return callback(null, true);
    
    const cleanOrigin = origin.replace(/\/$/, "");
    
    // Permitir si está en la lista explícita
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    
    // Permitir dinámicamente cualquier subdominio o dominio de Vercel (*.vercel.app)
    // Esto es sumamente útil para despliegues de producción y vistas previas en Vercel
    if (cleanOrigin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Advertencia en la consola de Render para ayudar al desarrollador
    console.warn(`[CORS Bloqueado] La petición desde el origen "${origin}" no está permitida por CORS.`);
    
    // IMPORTANTE: Retornar callback(null, false) en lugar de callback(new Error(...))
    // Esto evita que Express lance un error 500 interno y permite que el navegador bloquee la petición limpiamente
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Access-Control-Allow-Headers'
  ],
  optionsSuccessStatus: 204 // Código de estado exitoso para preflight OPTIONS
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Limitar peticiones a la API
app.use('/api', apiRateLimiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/instituciones', institucionRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/docentes', docenteRoutes);
app.use('/api/fichas', fichaRoutes);
app.use('/api/monitoreos', monitoreoRoutes);
app.use('/api/periodos', periodoRoutes);
app.use('/api/niveles', nivelRoutes);
app.use('/api/futs', futRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documentos', documentoRoutes);
app.use('/api/reportes', reporteRoutes);


app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistema de Monitoreo Docente API - Professional Modular Architecture',
    version: '1.0.0',
    env: config.env
  });
});

const errorHandler = require('./common/middlewares/errorHandler');

// ... (other app setup)

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
