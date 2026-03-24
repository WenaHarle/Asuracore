import { registerUser, authenticateUser, getUserById } from '../services/userService.js';

/**
 * Register auth routes
 */
export default async function authRoutes(fastify) {
  // Register new user
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, name } = request.body;
      const user = await registerUser(email, password, name);
      
      // Generate JWT token
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      
      return reply.code(201).send({
        user,
        token,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({ error: error.message });
    }
  });

  // Login
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password } = request.body;
      const user = await authenticateUser(email, password);
      
      // Generate JWT token
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      
      return reply.send({
        user,
        token,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({ error: error.message });
    }
  });

  // Get current user
  fastify.get('/auth/me', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = await getUserById(request.user.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return reply.send({ user });
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = await getUserById(request.user.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return reply.send({ token });
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
