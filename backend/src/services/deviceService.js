import crypto from 'crypto';
import { query, queryOne, queryMany } from '../db/postgres.js';
import { checkProjectOwnership } from './projectService.js';

/**
 * Generate a unique device key
 */
function generateDeviceKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Register a new device
 */
export async function registerDevice(projectId, deviceName, description = null) {
  const deviceKey = generateDeviceKey();
  
  const result = await queryOne(
    `INSERT INTO devices (project_id, device_name, device_key, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, project_id, device_name, device_key, description, is_online, created_at`,
    [projectId, deviceName, deviceKey, description]
  );
  
  return result;
}

/**
 * Get all devices for a project
 */
export async function getDevicesByProject(projectId) {
  const devices = await queryMany(
    `SELECT d.*, 
            (SELECT COUNT(*) FROM virtual_channels vc WHERE vc.device_id = d.id) as channel_count
     FROM devices d
     WHERE d.project_id = $1
     ORDER BY d.created_at DESC`,
    [projectId]
  );
  return devices;
}

/**
 * Get all devices for a user (across all projects)
 */
export async function getDevicesByUser(userId) {
  const devices = await queryMany(
    `SELECT d.*, p.name as project_name
     FROM devices d
     JOIN projects p ON d.project_id = p.id
     WHERE p.user_id = $1
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return devices;
}

/**
 * Get device by ID
 */
export async function getDeviceById(deviceId) {
  const device = await queryOne(
    `SELECT d.*, p.user_id, p.name as project_name
     FROM devices d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id = $1`,
    [deviceId]
  );
  return device;
}

/**
 * Get device by device key (for authentication)
 */
export async function getDeviceByKey(deviceKey) {
  const device = await queryOne(
    `SELECT d.*, p.user_id
     FROM devices d
     JOIN projects p ON d.project_id = p.id
     WHERE d.device_key = $1`,
    [deviceKey]
  );
  return device;
}

/**
 * Get device by ID or device_key (smart lookup)
 * This handles both UUID and device_key from MQTT topics
 */
export async function getDeviceByIdOrKey(identifier) {
  // First try by device_key (64 char hex)
  let device = await queryOne(
    `SELECT d.*, p.user_id
     FROM devices d
     JOIN projects p ON d.project_id = p.id
     WHERE d.device_key = $1`,
    [identifier]
  );
  
  // If not found, try by UUID
  if (!device) {
    device = await queryOne(
      `SELECT d.*, p.user_id
       FROM devices d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id::text = $1`,
      [identifier]
    );
  }
  
  return device;
}

/**
 * Update device
 */
export async function updateDevice(deviceId, updates) {
  const { device_name, description } = updates;
  const result = await queryOne(
    `UPDATE devices 
     SET device_name = COALESCE($2, device_name), description = COALESCE($3, description)
     WHERE id = $1
     RETURNING id, project_id, device_name, description, is_online, updated_at`,
    [deviceId, device_name, description]
  );
  return result;
}

/**
 * Update device online status
 */
export async function updateDeviceStatus(deviceId, isOnline) {
  const result = await queryOne(
    `UPDATE devices 
     SET is_online = $2, last_seen_at = CASE WHEN $2 THEN NOW() ELSE last_seen_at END
     WHERE id = $1
     RETURNING id, is_online, last_seen_at`,
    [deviceId, isOnline]
  );
  return result;
}

/**
 * Update device status by device key
 */
export async function updateDeviceStatusByKey(deviceKey, isOnline) {
  const result = await queryOne(
    `UPDATE devices 
     SET is_online = $2, last_seen_at = CASE WHEN $2 THEN NOW() ELSE last_seen_at END
     WHERE device_key = $1
     RETURNING id, device_name, is_online, last_seen_at`,
    [deviceKey, isOnline]
  );
  return result;
}

/**
 * Update device status by device ID (UUID from topic)
 */
export async function updateDeviceStatusById(deviceId, isOnline) {
  const result = await queryOne(
    `UPDATE devices 
     SET is_online = $2, last_seen_at = CASE WHEN $2 THEN NOW() ELSE last_seen_at END
     WHERE id::text = $1
     RETURNING id, device_name, is_online, last_seen_at`,
    [deviceId, isOnline]
  );
  return result;
}

/**
 * Regenerate device key
 */
export async function regenerateDeviceKey(deviceId) {
  const newKey = generateDeviceKey();
  const result = await queryOne(
    `UPDATE devices SET device_key = $2 WHERE id = $1
     RETURNING id, device_key`,
    [deviceId, newKey]
  );
  return result;
}

/**
 * Delete device
 */
export async function deleteDevice(deviceId) {
  await query('DELETE FROM devices WHERE id = $1', [deviceId]);
  return { success: true };
}

/**
 * Check if user owns device
 */
export async function checkDeviceOwnership(deviceId, userId) {
  const device = await queryOne(
    `SELECT p.user_id 
     FROM devices d 
     JOIN projects p ON d.project_id = p.id 
     WHERE d.id = $1`,
    [deviceId]
  );
  
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }
  
  if (device.user_id !== userId) {
    const error = new Error('Forbidden: You do not have access to this device');
    error.statusCode = 403;
    throw error;
  }
  
  return true;
}

export default {
  registerDevice,
  getDevicesByProject,
  getDevicesByUser,
  getDeviceById,
  getDeviceByKey,
  updateDevice,
  updateDeviceStatus,
  updateDeviceStatusByKey,
  updateDeviceStatusById,
  regenerateDeviceKey,
  deleteDevice,
  checkDeviceOwnership,
};
