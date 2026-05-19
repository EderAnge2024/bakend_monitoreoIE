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


const app = express();

// Middlewares - Morgan primero para registrar absolutamente todas las peticiones
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
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
