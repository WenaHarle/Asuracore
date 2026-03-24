// WebSocket connection manager
const connections = new Map();

/**
 * Register WebSocket plugin for Fastify
 * Registers at both /ws (for direct backend access) and /api/asura/ws (for proxy access)
 */
export function registerWebSocket(fastify) {
  // Define the WebSocket handler function
  const handleWebSocketConnection = (connection, req) => {
    const connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[WebSocket] Client connected: ${connectionId}`);
    
    // Store connection with metadata
    connections.set(connectionId, {
      socket: connection.socket,
      userId: null,
      subscriptions: new Set(),
    });

    // Handle incoming messages
    connection.socket.on('message', (message) => {
      handleClientMessage(connectionId, message);
    });

    // Handle disconnect
    connection.socket.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${connectionId}`);
      connections.delete(connectionId);
    });

    // Handle errors
    connection.socket.on('error', (error) => {
      console.error(`[WebSocket] Error for ${connectionId}:`, error);
      connections.delete(connectionId);
    });

    // Send welcome message
    sendToConnection(connectionId, {
      type: 'connected',
      connectionId,
      message: 'Welcome to AsuraCore WebSocket',
    });
  };

  // Register WebSocket at /ws (for direct backend access)
  fastify.get('/ws', { websocket: true }, handleWebSocketConnection);

  // Register WebSocket at /api/asura/ws (for reverse proxy access)
  fastify.get('/api/asura/ws', { websocket: true }, handleWebSocketConnection);
}

/**
 * Handle incoming client messages
 */
function handleClientMessage(connectionId, message) {
  try {
    const data = JSON.parse(message.toString());
    const conn = connections.get(connectionId);

    if (!conn) return;

    switch (data.type) {
      case 'auth':
        // Authenticate connection with JWT (optional)
        conn.userId = data.userId;
        console.log(`[WebSocket] Client ${connectionId} authenticated as user ${data.userId}`);
        break;

      case 'subscribe':
        // Subscribe to device updates
        if (data.deviceId) {
          conn.subscriptions.add(`device:${data.deviceId}`);
          console.log(`[WebSocket] Client ${connectionId} subscribed to device ${data.deviceId}`);
        }
        if (data.channel) {
          conn.subscriptions.add(`channel:${data.deviceId}:${data.channel}`);
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from device updates
        if (data.deviceId) {
          conn.subscriptions.delete(`device:${data.deviceId}`);
          conn.subscriptions.delete(`channel:${data.deviceId}:${data.channel}`);
        }
        break;

      case 'ping':
        // Respond to ping
        sendToConnection(connectionId, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        console.log(`[WebSocket] Unknown message type from ${connectionId}:`, data.type);
    }
  } catch (error) {
    console.error(`[WebSocket] Error parsing message from ${connectionId}:`, error);
  }
}

/**
 * Send message to specific connection
 */
function sendToConnection(connectionId, data) {
  const conn = connections.get(connectionId);
  if (conn && conn.socket.readyState === 1) {
    conn.socket.send(JSON.stringify(data));
  }
}

/**
 * Broadcast message to all connections
 */
export function broadcast(data) {
  const message = JSON.stringify(data);
  
  for (const [connectionId, conn] of connections) {
    try {
      if (conn.socket.readyState === 1) {
        // Check if connection is subscribed to this device/channel
        if (data.deviceId) {
          const deviceKey = `device:${data.deviceId}`;
          const channelKey = `channel:${data.deviceId}:${data.channel}`;
          
          // Only send if subscribed or no specific subscriptions
          if (conn.subscriptions.size === 0 || 
              conn.subscriptions.has(deviceKey) ||
              conn.subscriptions.has(channelKey)) {
            conn.socket.send(message);
          }
        } else {
          conn.socket.send(message);
        }
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending to ${connectionId}:`, error);
    }
  }
}

/**
 * Broadcast to specific device subscribers
 */
export function broadcastToDevice(deviceId, data) {
  const message = JSON.stringify({ ...data, deviceId });
  
  for (const [connectionId, conn] of connections) {
    try {
      if (conn.socket.readyState === 1) {
        const deviceKey = `device:${deviceId}`;
        if (conn.subscriptions.size === 0 || conn.subscriptions.has(deviceKey)) {
          conn.socket.send(message);
        }
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending to ${connectionId}:`, error);
    }
  }
}

/**
 * Get number of active connections
 */
export function getConnectionCount() {
  return connections.size;
}

/**
 * Get all active connections (for debugging)
 */
export function getConnections() {
  return Array.from(connections.entries()).map(([id, conn]) => ({
    id,
    userId: conn.userId,
    subscriptions: Array.from(conn.subscriptions),
  }));
}

export default {
  registerWebSocket,
  broadcast,
  broadcastToDevice,
  getConnectionCount,
  getConnections,
};
