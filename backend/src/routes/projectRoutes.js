import {
  createProject,
  getProjectsByUser,
  getProjectById,
  updateProject,
  deleteProject,
  checkProjectOwnership,
} from '../services/projectService.js';

/**
 * Register project routes
 */
export default async function projectRoutes(fastify) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Create project
  fastify.post('/projects', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { name, description } = request.body;
      const project = await createProject(request.user.id, name, description);
      return reply.code(201).send({ project });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Get all projects for user
  fastify.get('/projects', async (request, reply) => {
    try {
      const projects = await getProjectsByUser(request.user.id);
      return reply.send({ projects });
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get single project
  fastify.get('/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkProjectOwnership(id, request.user.id);
      const project = await getProjectById(id);
      return reply.send({ project });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Update project
  fastify.put('/projects/:id', {
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
      await checkProjectOwnership(id, request.user.id);
      const project = await updateProject(id, request.body);
      return reply.send({ project });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });

  // Delete project
  fastify.delete('/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await checkProjectOwnership(id, request.user.id);
      await deleteProject(id);
      return reply.send({ success: true, message: 'Project deleted' });
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message });
    }
  });
}
