import mqtt from 'mqtt';
import { config } from '../config/index.js';
import { getDeviceByKey, updateDeviceStatusByKey } from '../services/deviceService.js';
import { storeTelemetry } from '../services/telemetryService.js';

let mqttClient = null;
let websocketBroadcast = null;

// Device activity tracking for offline detection
// Maps device_key -> { lastActivity, deviceId }
const deviceLastActivity = new Map();
const OFFLINE_TIMEOUT = config.device?.offlineTimeout || 60000;
const CHECK_INTERVAL = config.device?.offlineCheckInterval || 30000;
let offlineCheckInterval = null;

// Topic patterns - device_key is 64 char hex string
const TOPICS = {
  DATA: 'device/+/data/+',      // device/{device_key}/data/{channel}
  STATUS: 'device/+/status',    // device/{device_key}/status
};

/**
 * Initialize MQTT client
 */
export function initMqttClient(wsBroadcast = null) {
  websocketBroadcast = wsBroadcast;

  const options = {
    clientId: `asuracore_backend_${Date.now()}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  };

  if (config.mqtt.username) {
    options.username = config.mqtt.username;
    options.password = config.mqtt.password;
  }

  mqttClient = mqtt.connect(config.mqtt.brokerUrl, options);

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker:', config.mqtt.brokerUrl);
    
    mqttClient.subscribe(TOPICS.DATA, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error (data):', err);
      else console.log('[MQTT] Subscribed to:', TOPICS.DATA);
    });

    mqttClient.subscribe(TOPICS.STATUS, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error (status):', err);
      else console.log('[MQTT] Subscribed to:', TOPICS.STATUS);
    });

    startOfflineCheck();
  });

  mqttClient.on('message', handleMessage);

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Connection error:', error);
  });

  mqttClient.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  mqttClient.on('close', () => {
    console.log('[MQTT] Connection closed');
  });

  return mqttClient;
}

/**
 * Handle incoming MQTT messages
 */
async function handleMessage(topic, message) {
  try {
    const topicParts = topic.split('/');
    
    if (topicParts[0] !== 'device' || topicParts.length < 3) {
      return;
    }

    const deviceKey = topicParts[1];
    const messageType = topicParts[2];
    
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (e) {
      // Try plain value for simple telemetry
      if (messageType === 'data' && topicParts.length === 4) {
        payload = { value: parseFloat(message.toString()) };
        if (isNaN(payload.value)) {
          console.error('[MQTT] Invalid payload:', message.toString());
          return;
        }
      } else {
        console.error('[MQTT] Invalid JSON payload:', message.toString());
        return;
      }
    }

    if (messageType === 'data' && topicParts.length === 4) {
      const channel = topicParts[3];
      await handleTelemetryData(deviceKey, channel, payload);
    } else if (messageType === 'status') {
      await handleStatusUpdate(deviceKey, payload);
    }
  } catch (error) {
    console.error('[MQTT] Error handling message:', error);
  }
}

/**
 * Handle telemetry data from device
 */
async function handleTelemetryData(deviceKey, channel, payload) {
  const { value, ts } = payload;
  
  if (value === undefined) {
    console.warn('[MQTT] Telemetry missing value:', payload);
    return;
  }

  // Lookup device by device_key
  const device = await getDeviceByKey(deviceKey);
  if (!device) {
    console.warn('[MQTT] Unknown device_key:', deviceKey.substring(0, 16) + '...');
    return;
  }
  
  const deviceId = device.id;

  // Update device activity and mark online
  updateDeviceActivity(deviceKey, deviceId);
  await updateDeviceStatusByKey(deviceKey, true);

  // Store in InfluxDB using device UUID
  await storeTelemetry(deviceId, channel, value, ts);

  console.log('[MQTT] Telemetry: device=' + deviceId + ', ch=' + channel + ', val=' + value);

  // Broadcast to WebSocket clients
  if (websocketBroadcast) {
    websocketBroadcast({
      type: 'telemetry',
      deviceId: deviceId,
      channel: String(channel),
      value: parseFloat(value),
      timestamp: ts || Date.now(),
    });
  }
}

/**
 * Handle device status update
 */
async function handleStatusUpdate(deviceKey, payload) {
  const { online, status } = payload;
  
  // Lookup device
  const device = await getDeviceByKey(deviceKey);
  if (!device) {
    console.warn('[MQTT] Status from unknown device_key:', deviceKey.substring(0, 16) + '...');
    return;
  }
  
  const deviceId = device.id;
  
  // Update activity tracking
  updateDeviceActivity(deviceKey, deviceId);

  if (online === true || status === 'online') {
    await updateDeviceStatusByKey(deviceKey, true);
    console.log('[MQTT] Status: device=' + deviceId + ', online=true');
  } else if (online === false || status === 'offline') {
    await updateDeviceStatusByKey(deviceKey, false);
    deviceLastActivity.delete(deviceKey);
    console.log('[MQTT] Status: device=' + deviceId + ', online=false');
  }

  // Broadcast to WebSocket
  if (websocketBroadcast) {
    websocketBroadcast({
      type: 'status',
      deviceId: deviceId,
      online: online !== false,
      timestamp: Date.now(),
    });
  }
}

/**
 * Update device activity timestamp
 */
function updateDeviceActivity(deviceKey, deviceId) {
  deviceLastActivity.set(deviceKey, {
    lastActivity: Date.now(),
    deviceId: deviceId,
  });
}

/**
 * Start offline detection interval
 */
function startOfflineCheck() {
  if (offlineCheckInterval) {
    clearInterval(offlineCheckInterval);
  }

  console.log('[MQTT] Starting offline detection (timeout: ' + (OFFLINE_TIMEOUT/1000) + 's, check: ' + (CHECK_INTERVAL/1000) + 's)');

  offlineCheckInterval = setInterval(async () => {
    const now = Date.now();
    
    for (const [deviceKey, info] of deviceLastActivity.entries()) {
      const timeSinceActivity = now - info.lastActivity;
      
      if (timeSinceActivity > OFFLINE_TIMEOUT) {
        console.log('[MQTT] Device ' + info.deviceId + ' inactive for ' + Math.round(timeSinceActivity/1000) + 's, marking offline');
        
        await updateDeviceStatusByKey(deviceKey, false);
        deviceLastActivity.delete(deviceKey);
        
        if (websocketBroadcast) {
          websocketBroadcast({
            type: 'status',
            deviceId: info.deviceId,
            online: false,
            reason: 'timeout',
            timestamp: now,
          });
        }
      }
    }
  }, CHECK_INTERVAL);
}

/**
 * Publish command to device
 */
export function publishCommand(deviceKey, command) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT client not connected');
  }

  const topic = 'device/' + deviceKey + '/command';
  const payload = JSON.stringify(command);

  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] Publish error:', err);
    } else {
      console.log('[MQTT] Command sent to ' + deviceKey.substring(0, 16) + '...');
    }
  });
}

/**
 * Get MQTT client instance
 */
export function getMqttClient() {
  return mqttClient;
}

/**
 * Close MQTT connection
 */
export function closeMqttClient() {
  if (offlineCheckInterval) {
    clearInterval(offlineCheckInterval);
  }
  if (mqttClient) {
    mqttClient.end();
    console.log('[MQTT] Client closed');
  }
}

/**
 * Get device activity (for debugging)
 */
export function getDeviceActivity() {
  const result = {};
  for (const [key, info] of deviceLastActivity.entries()) {
    result[info.deviceId] = {
      secondsAgo: Math.round((Date.now() - info.lastActivity) / 1000),
    };
  }
  return result;
}

export default {
  initMqttClient,
  publishCommand,
  getMqttClient,
  closeMqttClient,
  getDeviceActivity,
};
