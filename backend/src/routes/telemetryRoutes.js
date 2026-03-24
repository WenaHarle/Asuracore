import { getLatest, getHistory, getRecent } from '../services/telemetryService.js';
import { checkDeviceOwnership } from '../services/deviceService.js';

/**
 * Register telemetry routes
 */
export default async function telemetryRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get latest telemetry value
  fastify.get('/telemetry/:deviceId/:channel/latest', async (request, reply) => {
    try {
      const { deviceId, channel } = request.params;
      await checkDeviceOwnership(deviceId, request.user.id);
      
      const data = await getLatest(deviceId, channel);
      return reply.send({ data });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get telemetry history (for charts)
  fastify.get('/telemetry/:deviceId/:channel/history', async (request, reply) => {
    try {
      const { deviceId, channel } = request.params;
      const { range = '24h', limit = 1000 } = request.query;
      
      await checkDeviceOwnership(deviceId, request.user.id);
      
      const data = await getHistory(deviceId, channel, range, parseInt(limit));
      return reply.send({ data });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get recent telemetry rows (for tables)
  fastify.get('/telemetry/:deviceId/:channel/recent', async (request, reply) => {
    try {
      const { deviceId, channel } = request.params;
      const { limit = 20 } = request.query;
      
      await checkDeviceOwnership(deviceId, request.user.id);
      
      const data = await getRecent(deviceId, channel, parseInt(limit));
      return reply.send({ data });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });
}
