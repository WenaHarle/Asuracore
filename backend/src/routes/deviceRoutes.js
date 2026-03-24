import {
  registerDevice,
  getDevicesByProject,
  getDevicesByUser,
  getDeviceById,
  updateDevice,
  deleteDevice,
  regenerateDeviceKey,
  checkDeviceOwnership,
} from '../services/deviceService.js';
import { checkProjectOwnership } from '../services/projectService.js';
import { publishCommand } from '../mqtt/mqttClient.js';

/**
 * Register device routes
 */
export default async function deviceRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Register new device
  fastify.post('/devices', {
    schema: {
      body: {
        type: 'object',
        required: ['project_id', 'device_name'],
        properties: {
          project_id: { type: 'string', format: 'uuid' },
          device_name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { project_id, device_name, description } = request.body;
      
      // Verify user owns the project
      await checkProjectOwnership(project_id, request.user.id);
      
      const device = await registerDevice(project_id, device_name, description);
      return reply.code(201).send({ device });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get all devices for user
  fastify.get('/devices', async (request, reply) => {
    try {
      const { project_id } = request.query;
      
      let devices;
      if (project_id) {
        await checkProjectOwnership(project_id, request.user.id);
        devices = await getDevicesByProject(project_id);
      } else {
        devices = await getDevicesByUser(request.user.id);
      }
      
      return reply.send({ devices });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get single device
  fastify.get('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDeviceOwnership(id, request.user.id);
      const device = await getDeviceById(id);
      return reply.send({ device });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Update device
  fastify.put('/devices/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          device_name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDeviceOwnership(id, request.user.id);
      const device = await updateDevice(id, request.body);
      return reply.send({ device });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Regenerate device key
  fastify.post('/devices/:id/regenerate-key', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDeviceOwnership(id, request.user.id);
      const result = await regenerateDeviceKey(id);
      return reply.send({ device_key: result.device_key });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Send command to device
  fastify.post('/devices/:id/command', {
    schema: {
      body: {
        type: 'object',
        required: ['command'],
        properties: {
          command: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDeviceOwnership(id, request.user.id);
      
      const device = await getDeviceById(id);
      if (!device) {
        return reply.code(404).send({ error: 'Device not found' });
      }

      // Publish command to MQTT
      publishCommand(device.device_key, request.body.command);
      
      return reply.send({ success: true, message: 'Command sent' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Delete device
  fastify.delete('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDeviceOwnership(id, request.user.id);
      await deleteDevice(id);
      return reply.send({ success: true, message: 'Device deleted' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });
}
