import { query, queryOne, queryMany } from '../db/postgres.js';

/**
 * Create a new project
 */
export async function createProject(userId, name, description = null) {
  const result = await queryOne(
    `INSERT INTO projects (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, name, description, created_at`,
    [userId, name, description]
  );
  return result;
}

/**
 * Get all projects for a user
 */
export async function getProjectsByUser(userId) {
  const projects = await queryMany(
    `SELECT p.*, 
            (SELECT COUNT(*) FROM devices d WHERE d.project_id = p.id) as device_count,
            (SELECT COUNT(*) FROM dashboards db WHERE db.project_id = p.id) as dashboard_count
     FROM projects p
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return projects;
}

/**
 * Get project by ID
 */
export async function getProjectById(projectId) {
  const project = await queryOne(
    `SELECT p.*, u.email as owner_email
     FROM projects p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [projectId]
  );
  return project;
}

/**
 * Update project
 */
export async function updateProject(projectId, updates) {
  const { name, description } = updates;
  const result = await queryOne(
    `UPDATE projects 
     SET name = COALESCE($2, name), description = COALESCE($3, description)
     WHERE id = $1
     RETURNING id, user_id, name, description, updated_at`,
    [projectId, name, description]
  );
  return result;
}

/**
 * Delete project
 */
export async function deleteProject(projectId) {
  await query('DELETE FROM projects WHERE id = $1', [projectId]);
  return { success: true };
}

/**
 * Check if user owns project
 */
export async function checkProjectOwnership(projectId, userId) {
  const project = await queryOne(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  );
  
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (project.user_id !== userId) {
    const error = new Error('Forbidden: You do not have access to this project');
    error.statusCode = 403;
    throw error;
  }
  
  return true;
}

export default {
  createProject,
  getProjectsByUser,
  getProjectById,
  updateProject,
  deleteProject,
  checkProjectOwnership,
};
