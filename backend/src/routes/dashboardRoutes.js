import {
  createDashboard,
  getDashboardsByProject,
  getDashboardsByUser,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  checkDashboardOwnership,
} from '../services/dashboardService.js';
import { checkProjectOwnership } from '../services/projectService.js';

/**
 * Register dashboard routes
 */
export default async function dashboardRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Create dashboard
  fastify.post('/dashboards', {
    schema: {
      body: {
        type: 'object',
        required: ['project_id', 'name'],
        properties: {
          project_id: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { project_id, name, description } = request.body;
      
      // Verify user owns the project
      await checkProjectOwnership(project_id, request.user.id);
      
      const dashboard = await createDashboard(project_id, name, description);
      return reply.code(201).send({ dashboard });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get all dashboards
  fastify.get('/dashboards', async (request, reply) => {
    try {
      const { project_id } = request.query;
      
      let dashboards;
      if (project_id) {
        await checkProjectOwnership(project_id, request.user.id);
        dashboards = await getDashboardsByProject(project_id);
      } else {
        dashboards = await getDashboardsByUser(request.user.id);
      }
      
      return reply.send({ dashboards });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get single dashboard with widgets
  fastify.get('/dashboards/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDashboardOwnership(id, request.user.id);
      const dashboard = await getDashboardById(id);
      return reply.send({ dashboard });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Update dashboard
  fastify.put('/dashboards/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDashboardOwnership(id, request.user.id);
      const dashboard = await updateDashboard(id, request.body);
      return reply.send({ dashboard });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Delete dashboard
  fastify.delete('/dashboards/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkDashboardOwnership(id, request.user.id);
      await deleteDashboard(id);
      return reply.send({ success: true, message: 'Dashboard deleted' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });
}
