import { query, queryOne, queryMany } from '../db/postgres.js';

// Supported widget types
export const WIDGET_TYPES = {
  CHART: 'chart',
  GAUGE: 'gauge',
  SINGLE: 'single',
  TABLE: 'table',
  SWITCH: 'switch',
  STATUS: 'status',
};

/**
 * Create a new widget
 */
export async function createWidget(dashboardId, widgetData) {
  const {
    device_id,
    channel_key,
    type,
    config_json = {},
    pos_x = 0,
    pos_y = 0,
    width = 2,
    height = 2,
  } = widgetData;

  const result = await queryOne(
    `INSERT INTO widgets (dashboard_id, device_id, channel_key, type, config_json, pos_x, pos_y, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [dashboardId, device_id, channel_key, type, JSON.stringify(config_json), pos_x, pos_y, width, height]
  );
  return result;
}

/**
 * Get widget by ID
 */
export async function getWidgetById(widgetId) {
  const widget = await queryOne(
    `SELECT w.*, d.project_id, p.user_id
     FROM widgets w
     JOIN dashboards d ON w.dashboard_id = d.id
     JOIN projects p ON d.project_id = p.id
     WHERE w.id = $1`,
    [widgetId]
  );
  return widget;
}

/**
 * Get all widgets for a dashboard
 */
export async function getWidgetsByDashboard(dashboardId) {
  const widgets = await queryMany(
    `SELECT w.*, dev.device_name
     FROM widgets w
     LEFT JOIN devices dev ON w.device_id = dev.id
     WHERE w.dashboard_id = $1
     ORDER BY w.pos_y, w.pos_x`,
    [dashboardId]
  );
  return widgets;
}

/**
 * Update widget
 */
export async function updateWidget(widgetId, updates) {
  const {
    device_id,
    channel_key,
    type,
    config_json,
    pos_x,
    pos_y,
    width,
    height,
  } = updates;

  const result = await queryOne(
    `UPDATE widgets 
     SET 
       device_id = COALESCE($2, device_id),
       channel_key = COALESCE($3, channel_key),
       type = COALESCE($4, type),
       config_json = COALESCE($5, config_json),
       pos_x = COALESCE($6, pos_x),
       pos_y = COALESCE($7, pos_y),
       width = COALESCE($8, width),
       height = COALESCE($9, height)
     WHERE id = $1
     RETURNING *`,
    [
      widgetId,
      device_id,
      channel_key,
      type,
      config_json ? JSON.stringify(config_json) : null,
      pos_x,
      pos_y,
      width,
      height,
    ]
  );
  return result;
}

/**
 * Update widget position only (for drag-and-drop)
 */
export async function updateWidgetPosition(widgetId, pos_x, pos_y) {
  const result = await queryOne(
    `UPDATE widgets SET pos_x = $2, pos_y = $3 WHERE id = $1
     RETURNING id, pos_x, pos_y`,
    [widgetId, pos_x, pos_y]
  );
  return result;
}

/**
 * Update widget size only (for resize)
 */
export async function updateWidgetSize(widgetId, width, height) {
  const result = await queryOne(
    `UPDATE widgets SET width = $2, height = $3 WHERE id = $1
     RETURNING id, width, height`,
    [widgetId, width, height]
  );
  return result;
}

/**
 * Batch update widget layouts
 */
export async function updateWidgetLayouts(layouts) {
  const results = [];
  for (const layout of layouts) {
    const { id, pos_x, pos_y, width, height } = layout;
    const result = await queryOne(
      `UPDATE widgets SET pos_x = $2, pos_y = $3, width = $4, height = $5 WHERE id = $1
       RETURNING id, pos_x, pos_y, width, height`,
      [id, pos_x, pos_y, width, height]
    );
    if (result) results.push(result);
  }
  return results;
}

/**
 * Delete widget
 */
export async function deleteWidget(widgetId) {
  await query('DELETE FROM widgets WHERE id = $1', [widgetId]);
  return { success: true };
}

/**
 * Check if user owns widget
 */
export async function checkWidgetOwnership(widgetId, userId) {
  const widget = await queryOne(
    `SELECT p.user_id 
     FROM widgets w 
     JOIN dashboards d ON w.dashboard_id = d.id
     JOIN projects p ON d.project_id = p.id 
     WHERE w.id = $1`,
    [widgetId]
  );
  
  if (!widget) {
    const error = new Error('Widget not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (widget.user_id !== userId) {
    const error = new Error('Forbidden: You do not have access to this widget');
    error.statusCode = 403;
    throw error;
  }
  
  return true;
}

export default {
  WIDGET_TYPES,
  createWidget,
  getWidgetById,
  getWidgetsByDashboard,
  updateWidget,
  updateWidgetPosition,
  updateWidgetSize,
  updateWidgetLayouts,
  deleteWidget,
  checkWidgetOwnership,
};
