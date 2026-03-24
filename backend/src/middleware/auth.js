import { config } from '../config/index.js';

/**
 * JWT authentication middleware for Fastify
 */
export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    // Token is optional, continue without user
    request.user = null;
  }
}

/**
 * Check if user owns a resource
 * @param {string} resourceUserId - The user_id of the resource
 * @param {string} requestUserId - The authenticated user's ID
 */
export function checkOwnership(resourceUserId, requestUserId) {
  if (resourceUserId !== requestUserId) {
    const error = new Error('Forbidden: You do not have access to this resource');
    error.statusCode = 403;
    throw error;
  }
}

export default { authenticate, optionalAuth, checkOwnership };
