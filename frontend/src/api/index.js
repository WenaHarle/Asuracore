const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * API_URL is the base URL that includes the /api/asura prefix.
 * 
 * Examples:
 * - Local: http://localhost:4000 (backend directly)
 * - Production: https://<your-domain>/api/asura (through reverse proxy)
 * 
 * All endpoint paths should NOT include /api/asura since it's already in the base URL.
 * 
 * ✅ CORRECT: apiFetch('/<endpoint>', ...) 
 *    → https://<your-domain>/api/asura/<endpoint>
 * 
 * ❌ WRONG: apiFetch('/api/asura/<endpoint>', ...)
 *    → https://<your-domain>/api/asura/api/asura/<endpoint> (404 error)
 */

// Get auth token from localStorage
function getToken() {
  return localStorage.getItem('asuracore_token');
}

// Base fetch with auth
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized
  if (response.status === 401) {
    localStorage.removeItem('asuracore_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

// Auth API
export const authApi = {
  login: (email, password) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email, password, name) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  me: () => apiFetch('/auth/me'),
};

// Projects API
export const projectsApi = {
  list: () => apiFetch('/projects'),
  
  get: (id) => apiFetch(`/projects/${id}`),
  
  create: (name, description) =>
    apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  update: (id, data) =>
    apiFetch(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    apiFetch(`/projects/${id}`, {
      method: 'DELETE',
    }),
};

// Devices API
export const devicesApi = {
  list: (projectId = null) => {
    const query = projectId ? `?project_id=${projectId}` : '';
    return apiFetch(`/devices${query}`);
  },

  get: (id) => apiFetch(`/devices/${id}`),

  create: (project_id, device_name, description) =>
    apiFetch('/devices', {
      method: 'POST',
      body: JSON.stringify({ project_id, device_name, description }),
    }),

  update: (id, data) =>
    apiFetch(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    apiFetch(`/devices/${id}`, {
      method: 'DELETE',
    }),

  sendCommand: (id, command) =>
    apiFetch(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  regenerateKey: (id) =>
    apiFetch(`/devices/${id}/regenerate-key`, {
      method: 'POST',
    }),
};

// Dashboards API
export const dashboardsApi = {
  list: (projectId = null) => {
    const query = projectId ? `?project_id=${projectId}` : '';
    return apiFetch(`/dashboards${query}`);
  },

  get: (id) => apiFetch(`/dashboards/${id}`),

  create: (project_id, name, description) =>
    apiFetch('/dashboards', {
      method: 'POST',
      body: JSON.stringify({ project_id, name, description }),
    }),

  update: (id, data) =>
    apiFetch(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    apiFetch(`/dashboards/${id}`, {
      method: 'DELETE',
    }),
};

// Widgets API
export const widgetsApi = {
  create: (data) =>
    apiFetch('/widgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    apiFetch(`/widgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateLayouts: (layouts) =>
    apiFetch('/widgets/layouts', {
      method: 'PUT',
      body: JSON.stringify({ layouts }),
    }),

  delete: (id) =>
    apiFetch(`/widgets/${id}`, {
      method: 'DELETE',
    }),
};

// Telemetry API
export const telemetryApi = {
  getLatest: (deviceId, channel) =>
    apiFetch(`/telemetry/${deviceId}/${channel}/latest`),

  getHistory: (deviceId, channel, range = '24h', limit = 1000) =>
    apiFetch(`/telemetry/${deviceId}/${channel}/history?range=${range}&limit=${limit}`),

  getRecent: (deviceId, channel, limit = 20) =>
    apiFetch(`/telemetry/${deviceId}/${channel}/recent?limit=${limit}`),
};

export default {
  authApi,
  projectsApi,
  devicesApi,
  dashboardsApi,
  widgetsApi,
  telemetryApi,
};
