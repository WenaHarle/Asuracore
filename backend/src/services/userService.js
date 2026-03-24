import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/postgres.js';

const SALT_ROUNDS = 12;

/**
 * Register a new user
 */
export async function registerUser(email, password, name = null) {
  // Check if user exists
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const result = await queryOne(
    `INSERT INTO users (email, password_hash, name) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, name, created_at`,
    [email, passwordHash, name]
  );

  return result;
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email, password) {
  const user = await queryOne(
    'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
    [email]
  );

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Remove password hash from response
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  const user = await queryOne(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );
  return user;
}

/**
 * Update user
 */
export async function updateUser(userId, updates) {
  const { name, email } = updates;
  const result = await queryOne(
    `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email)
     WHERE id = $1
     RETURNING id, email, name, updated_at`,
    [userId, name, email]
  );
  return result;
}

export default {
  registerUser,
  authenticateUser,
  getUserById,
  updateUser,
};
