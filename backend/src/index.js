import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { config } from './config/index.js';
import { pool } from './db/postgres.js';
import { initMqttClient } from './mqtt/mqttClient.js';
import { registerWebSocket, broadcast } from './websocket/wsHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import widgetRoutes from './routes/widgetRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    transport: config.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register plugins
await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://devel-ai.ub.ac.id',
    'http://devel-ai.ub.ac.id',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

await fastify.register(jwt, {
  secret: config.jwt.secret,
  sign: {
    expiresIn: config.jwt.expiresIn,
  },
});

await fastify.register(websocket);

// Decorate fastify with authenticate helper
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString(), service: 'asuracore-backend' };
});

// API info endpoint
fastify.get('/', async () => {
  return {
    name: 'AsuraCore API',
    version: '1.0.0',
    description: 'IoT Platform Backend API',
    endpoints: {
      health: '/health',
      auth: '/api/asura/auth/*',
      projects: '/api/asura/projects/*',
      devices: '/api/asura/devices/*',
      dashboards: '/api/asura/dashboards/*',
      widgets: '/api/asura/widgets/*',
      telemetry: '/api/asura/telemetry/*',
      websocket: '/ws',
    },
  };
});

// Add health endpoint under /api/asura prefix
fastify.get('/api/asura/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString(), service: 'asuracore-backend' };
});

// Add API info endpoint under /api/asura prefix
fastify.get('/api/asura/', async () => {
  return {
    name: 'AsuraCore API',
    version: '1.0.0',
    description: 'IoT Platform Backend API',
    endpoints: {
      health: '/api/asura/health',
      auth: '/api/asura/auth/*',
      projects: '/api/asura/projects/*',
      devices: '/api/asura/devices/*',
      dashboards: '/api/asura/dashboards/*',
      widgets: '/api/asura/widgets/*',
      telemetry: '/api/asura/telemetry/*',
      websocket: '/api/asura/ws',
    },
  };
});

// Register routes with /api/asura prefix
await fastify.register(authRoutes, { prefix: '/api/asura' });
await fastify.register(projectRoutes, { prefix: '/api/asura' });
await fastify.register(deviceRoutes, { prefix: '/api/asura' });
await fastify.register(dashboardRoutes, { prefix: '/api/asura' });
await fastify.register(widgetRoutes, { prefix: '/api/asura' });
await fastify.register(telemetryRoutes, { prefix: '/api/asura' });

// Register WebSocket handler
registerWebSocket(fastify);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : message,
    message: config.nodeEnv === 'development' ? error.message : undefined,
    stack: config.nodeEnv === 'development' ? error.stack : undefined,
  });
});

// Graceful shutdown
const shutdown = async (signal) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await fastify.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    fastify.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
const start = async () => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    fastify.log.info('[PostgreSQL] Database connection successful');

    // Initialize MQTT client with WebSocket broadcast
    initMqttClient(broadcast);

    // Start server
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     █████╗ ███████╗██╗   ██╗██████╗  █████╗                ║
║    ██╔══██╗██╔════╝██║   ██║██╔══██╗██╔══██╗               ║
║    ███████║███████╗██║   ██║██████╔╝███████║               ║
║    ██╔══██║╚════██║██║   ██║██╔══██╗██╔══██║               ║
║    ██║  ██║███████║╚██████╔╝██║  ██║██║  ██║               ║
║    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝               ║
║                     CORE                                   ║
║                                                            ║
║    IoT Platform Backend v1.0.0                             ║
║    Server running on http://${config.host}:${config.port}              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error('Error starting server:', err);
    process.exit(1);
  }
};

start();
