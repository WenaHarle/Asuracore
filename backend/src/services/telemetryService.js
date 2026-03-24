import {
  writeTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
  getRecentTelemetry,
} from '../db/influxdb.js';

/**
 * Store telemetry data
 */
export async function storeTelemetry(deviceId, channel, value, timestamp = null) {
  await writeTelemetry(deviceId, channel, value, timestamp);
  return { success: true };
}

/**
 * Get latest telemetry value for a device channel
 */
export async function getLatest(deviceId, channel) {
  const data = await getLatestTelemetry(deviceId, channel);
  return data;
}

/**
 * Get telemetry history for charts
 */
export async function getHistory(deviceId, channel, range = '24h', limit = 1000) {
  const data = await getTelemetryHistory(deviceId, channel, range, limit);
  return data;
}

/**
 * Get recent telemetry rows for table widget
 */
export async function getRecent(deviceId, channel, limit = 20) {
  const data = await getRecentTelemetry(deviceId, channel, limit);
  return data;
}

export default {
  storeTelemetry,
  getLatest,
  getHistory,
  getRecent,
};
