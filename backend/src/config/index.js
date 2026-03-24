import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // PostgreSQL
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'asuracore',
    user: process.env.POSTGRES_USER || 'asuracore',
    password: process.env.POSTGRES_PASSWORD || (() => {
      throw new Error('POSTGRES_PASSWORD environment variable is required');
    })(),
  },

  // InfluxDB
  influxdb: {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN || (() => {
      throw new Error('INFLUXDB_TOKEN environment variable is required');
    })(),
    org: process.env.INFLUXDB_ORG || 'asuracore',
    bucket: process.env.INFLUXDB_BUCKET || 'telemetry',
  },

  // MQTT
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
  },

  // Device status
  device: {
    // Time (ms) without activity before device is marked offline
    offlineTimeout: parseInt(process.env.DEVICE_OFFLINE_TIMEOUT || '60000'),
    // How often to check for offline devices (ms)
    offlineCheckInterval: parseInt(process.env.DEVICE_OFFLINE_CHECK_INTERVAL || '30000'),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      throw new Error('JWT_SECRET environment variable is required');
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
