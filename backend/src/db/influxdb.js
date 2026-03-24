import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { config } from '../config/index.js';

// Create InfluxDB client
const influxDB = new InfluxDB({
  url: config.influxdb.url,
  token: config.influxdb.token,
});

// Write API - use 'ms' precision for milliseconds
const writeApi = influxDB.getWriteApi(config.influxdb.org, config.influxdb.bucket, 'ms');
writeApi.useDefaultTags({ source: 'asuracore' });

// Query API
const queryApi = influxDB.getQueryApi(config.influxdb.org);

/**
 * Write telemetry data point
 * @param {string} deviceId - Device ID
 * @param {string} channel - Virtual channel (0, 1, etc.)
 * @param {number} value - Telemetry value
 * @param {number} timestamp - Optional Unix timestamp in milliseconds
 */
export async function writeTelemetry(deviceId, channel, value, timestamp = null) {
  try {
    const point = new Point('telemetry')
      .tag('device_id', String(deviceId))
      .tag('channel', String(channel))
      .floatField('value', parseFloat(value));

    // Handle timestamp - if it's too small (device uptime), use current time
    // Unix timestamp for year 2000 is ~946684800000ms
    const MIN_VALID_TIMESTAMP = 946684800000;
    
    if (timestamp && timestamp > MIN_VALID_TIMESTAMP) {
      point.timestamp(new Date(timestamp));
    } else {
      // Device sent uptime or no timestamp - use server time
      point.timestamp(new Date());
    }

    writeApi.writePoint(point);
    
    // Force flush immediately
    await writeApi.flush();
    
    console.log(`[InfluxDB] Written: device=${deviceId}, channel=${channel}, value=${value}`);
  } catch (error) {
    console.error('[InfluxDB] Write error:', error.message);
    // Don't throw - continue even if influxdb write fails
  }
}

/**
 * Query latest telemetry value
 * @param {string} deviceId - Device ID
 * @param {string} channel - Virtual channel
 * @returns {Object|null} Latest data point
 */
export async function getLatestTelemetry(deviceId, channel) {
  const query = `
    from(bucket: "${config.influxdb.bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "telemetry")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.channel == "${channel}")
      |> filter(fn: (r) => r._field == "value")
      |> last()
  `;

  return new Promise((resolve, reject) => {
    let result = null;
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        result = {
          value: data._value,
          timestamp: data._time,
          deviceId: data.device_id,
          channel: data.channel,
        };
      },
      error(error) {
        console.error('[InfluxDB] Query error:', error);
        reject(error);
      },
      complete() {
        resolve(result);
      },
    });
  });
}

/**
 * Query telemetry history
 * @param {string} deviceId - Device ID
 * @param {string} channel - Virtual channel
 * @param {string} range - Time range (e.g., '1h', '24h', '7d')
 * @param {number} limit - Maximum number of points
 * @returns {Array} Array of data points
 */
export async function getTelemetryHistory(deviceId, channel, range = '24h', limit = 1000) {
  const query = `
    from(bucket: "${config.influxdb.bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "telemetry")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.channel == "${channel}")
      |> filter(fn: (r) => r._field == "value")
      |> sort(columns: ["_time"], desc: false)
      |> limit(n: ${limit})
  `;

  return new Promise((resolve, reject) => {
    const results = [];
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        results.push({
          value: data._value,
          timestamp: data._time,
        });
      },
      error(error) {
        console.error('[InfluxDB] Query error:', error);
        reject(error);
      },
      complete() {
        resolve(results);
      },
    });
  });
}

/**
 * Query recent telemetry rows (for table widget)
 * @param {string} deviceId - Device ID
 * @param {string} channel - Virtual channel
 * @param {number} limit - Number of rows
 * @returns {Array} Array of recent data points
 */
export async function getRecentTelemetry(deviceId, channel, limit = 20) {
  const query = `
    from(bucket: "${config.influxdb.bucket}")
      |> range(start: -7d)
      |> filter(fn: (r) => r._measurement == "telemetry")
      |> filter(fn: (r) => r.device_id == "${deviceId}")
      |> filter(fn: (r) => r.channel == "${channel}")
      |> filter(fn: (r) => r._field == "value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: ${limit})
  `;

  return new Promise((resolve, reject) => {
    const results = [];
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        results.push({
          value: data._value,
          timestamp: data._time,
        });
      },
      error(error) {
        console.error('[InfluxDB] Query error:', error);
        reject(error);
      },
      complete() {
        resolve(results);
      },
    });
  });
}

export default {
  writeTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
  getRecentTelemetry,
};
