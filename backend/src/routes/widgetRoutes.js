import {
  createWidget,
  getWidgetById,
  updateWidget,
  updateWidgetLayouts,
  deleteWidget,
  checkWidgetOwnership,
} from '../services/widgetService.js';
import { checkDashboardOwnership } from '../services/dashboardService.js';

/**
 * Register widget routes
 */
export default async function widgetRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Create widget
  fastify.post('/widgets', {
    schema: {
      body: {
        type: 'object',
        required: ['dashboard_id', 'type'],
        properties: {
          dashboard_id: { type: 'string', format: 'uuid' },
          device_id: { type: ['string', 'null'], format: 'uuid', nullable: true },
          channel_key: { type: 'string' },
          type: { type: 'string', enum: ['chart', 'gauge', 'single', 'table', 'switch', 'slider', 'status'] },
          config_json: { type: 'object' },
          pos_x: { type: 'integer', minimum: 0 },
          pos_y: { type: 'integer', minimum: 0 },
          width: { type: 'integer', minimum: 1 },
          height: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { dashboard_id, ...widgetData } = request.body;
      
      // Verify user owns the dashboard
      await checkDashboardOwnership(dashboard_id, request.user.id);
      
      const widget = await createWidget(dashboard_id, widgetData);
      return reply.code(201).send({ widget });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get single widget
  fastify.get('/widgets/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkWidgetOwnership(id, request.user.id);
      const widget = await getWidgetById(id);
      return reply.send({ widget });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Update widget
  fastify.put('/widgets/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          device_id: { type: ['string', 'null'], format: 'uuid', nullable: true },
          channel_key: { type: 'string' },
          type: { type: 'string', enum: ['chart', 'gauge', 'single', 'table', 'switch', 'slider', 'status'] },
          config_json: { type: 'object' },
          pos_x: { type: 'integer', minimum: 0 },
          pos_y: { type: 'integer', minimum: 0 },
          width: { type: 'integer', minimum: 1 },
          height: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      await checkWidgetOwnership(id, request.user.id);
      const widget = await updateWidget(id, request.body);
      return reply.send({ widget });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Batch update widget layouts
  fastify.put('/widgets/layouts', {
    schema: {
      body: {
        type: 'object',
        required: ['layouts'],
        properties: {
          layouts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'pos_x', 'pos_y', 'width', 'height'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                pos_x: { type: 'integer', minimum: 0 },
                pos_y: { type: 'integer', minimum: 0 },
                width: { type: 'integer', minimum: 1 },
                height: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { layouts } = request.body;
      
      // Verify ownership of all widgets
      for (const layout of layouts) {
        await checkWidgetOwnership(layout.id, request.user.id);
      }
      
      const results = await updateWidgetLayouts(layouts);
      return reply.send({ layouts: results });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Delete widget
  fastify.delete('/widgets/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkWidgetOwnership(id, request.user.id);
      await deleteWidget(id);
      return reply.send({ success: true, message: 'Widget deleted' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });
}
