import { query, queryOne, queryMany } from '../db/postgres.js';

/**
 * Create a new dashboard
 */
export async function createDashboard(projectId, name, description = null) {
  const result = await queryOne(
    `INSERT INTO dashboards (project_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, name, description, created_at`,
    [projectId, name, description]
  );
  return result;
}

/**
 * Get all dashboards for a project
 */
export async function getDashboardsByProject(projectId) {
  const dashboards = await queryMany(
    `SELECT d.*, 
            (SELECT COUNT(*) FROM widgets w WHERE w.dashboard_id = d.id) as widget_count
     FROM dashboards d
     WHERE d.project_id = $1
     ORDER BY d.created_at DESC`,
    [projectId]
  );
  return dashboards;
}

/**
 * Get all dashboards for a user (across all projects)
 */
export async function getDashboardsByUser(userId) {
  const dashboards = await queryMany(
    `SELECT d.*, p.name as project_name
     FROM dashboards d
     JOIN projects p ON d.project_id = p.id
     WHERE p.user_id = $1
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return dashboards;
}

/**
 * Get dashboard by ID with widgets
 */
export async function getDashboardById(dashboardId) {
  const dashboard = await queryOne(
    `SELECT d.*, p.user_id, p.name as project_name
     FROM dashboards d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id = $1`,
    [dashboardId]
  );
  
  if (!dashboard) return null;
  
  // Get widgets for this dashboard
  const widgets = await queryMany(
    `SELECT w.*, dev.device_name
     FROM widgets w
     LEFT JOIN devices dev ON w.device_id = dev.id
     WHERE w.dashboard_id = $1
     ORDER BY w.pos_y, w.pos_x`,
    [dashboardId]
  );
  
  dashboard.widgets = widgets;
  return dashboard;
}

/**
 * Update dashboard
 */
export async function updateDashboard(dashboardId, updates) {
  const { name, description } = updates;
  const result = await queryOne(
    `UPDATE dashboards 
     SET name = COALESCE($2, name), description = COALESCE($3, description)
     WHERE id = $1
     RETURNING id, project_id, name, description, updated_at`,
    [dashboardId, name, description]
  );
  return result;
}

/**
 * Delete dashboard
 */
export async function deleteDashboard(dashboardId) {
  await query('DELETE FROM dashboards WHERE id = $1', [dashboardId]);
  return { success: true };
}

/**
 * Check if user owns dashboard
 */
export async function checkDashboardOwnership(dashboardId, userId) {
  const dashboard = await queryOne(
    `SELECT p.user_id 
     FROM dashboards d 
     JOIN projects p ON d.project_id = p.id 
     WHERE d.id = $1`,
    [dashboardId]
  );
  
  if (!dashboard) {
    const error = new Error('Dashboard not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (dashboard.user_id !== userId) {
    const error = new Error('Forbidden: You do not have access to this dashboard');
    error.statusCode = 403;
    throw error;
  }
  
  return true;
}

export default {
  createDashboard,
  getDashboardsByProject,
  getDashboardsByUser,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  checkDashboardOwnership,
};
