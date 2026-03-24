# Changelog

All notable changes to this project will be documented in this file.

---

## [1.1.0] - 2026-03-24

### Fixed

#### API Endpoint Path Duplication Issue
- **Problem**: Frontend API calls were being doubled with `/api/asura` prefix appearing twice in the URL path
  - Example: `https://domain.com/api/asura/api/asura/auth/login` (404)
- **Root Cause**: Endpoint definitions in `frontend/src/api/index.js` included `/api/asura` prefix, but the base `API_URL` also contained it
- **Solution**: Removed `/api/asura` prefix from all 25 endpoint definitions across 6 API modules

#### WebSocket Connection Issue
- **Problem**: WebSocket connection failing with error: `wss://devel-ai.ub.ac.id/api/asura/ws failed`
- **Root Cause**: Backend WebSocket endpoint only registered at `/ws` path, not `/api/asura/ws` (required by reverse proxy)
- **Solution**: Added `/api/asura/ws` route registration in WebSocket handler to support both direct and proxied connections
- **Files Modified**:
  - `backend/src/websocket/wsHandler.js`: Added `/api/asura/ws` endpoint
  - `backend/src/index.js`: Updated API info endpoint to show correct WebSocket path
  
**Affected Endpoints (25 total):**
- Auth API (3): `login`, `register`, `me`
- Projects API (5): `list`, `get`, `create`, `update`, `delete`
- Devices API (6): `list`, `get`, `create`, `update`, `delete`, `sendCommand`, `regenerateKey`
- Dashboards API (4): `list`, `get`, `create`, `update`, `delete`
- Widgets API (4): `create`, `update`, `updateLayouts`, `delete`
- Telemetry API (3): `getLatest`, `getHistory`, `getRecent`

**Before:**
```javascript
const API_URL = 'https://devel-ai.ub.ac.id/api/asura';
export const authApi = {
  login: () => apiFetch('/api/asura/auth/login', ...) 
  // Results in: API_URL + /api/asura/auth/login = /api/asura/api/asura/auth/login ❌
}
```

**After:**
```javascript
const API_URL = 'https://devel-ai.ub.ac.id/api/asura';
export const authApi = {
  login: () => apiFetch('/auth/login', ...)
  // Results in: API_URL + /auth/login = /api/asura/auth/login ✅
}
```

### Added

#### Deployment Documentation
- Created `DEPLOYMENT.md` with comprehensive deployment guide including:
  - Step-by-step reverse proxy (Nginx Proxy Manager) configuration
  - Verification procedures for all services
  - Troubleshooting guide for common issues
  - Performance optimization tips
  - Database backup procedures

#### Code Documentation
- Added detailed comments to `frontend/src/api/index.js` explaining:
  - Why endpoint paths don't include `/api/asura` prefix
  - Correct vs incorrect usage patterns
  - Build-time environment variable embedding

#### README Enhancements
- Added "Deployment with Nginx Reverse Proxy" section covering:
  - Backend route configuration (`/api/asura` → port 4000)
  - Frontend route configuration (`/asuracore` → port 80)
  - Docker asset symlink setup
  - Important API URL structure notes
- Updated API Endpoints section with:
  - Full `/api/asura` prefixes for clarity
  - Additional endpoints (`regenerate-key`, `health`)
  - Query parameter examples
  - Complete endpoint documentation

### Changed

#### Frontend Build Configuration
- Updated `docker-compose.yml` frontend build args to use domain URLs by default:
  ```yaml
  VITE_API_URL: ${FRONTEND_API_URL:-https://devel-ai.ub.ac.id/api/asura}
  VITE_WS_URL: ${FRONTEND_WS_URL:-wss://devel-ai.ub.ac.id/api/asura}
  ```

#### Fallback URLs
- Changed fallback API URL in `frontend/src/api/index.js` from `http://localhost:4000` to `https://devel-ai.ub.ac.id/api/asura`
- Changed fallback WebSocket URL in `frontend/src/hooks/useWebSocket.js` from `ws://localhost:4000` to `wss://devel-ai.ub.ac.id/api/asura`

### Verified

- ✅ Backend health endpoint responding: `GET /api/asura/health` → 200 OK
- ✅ Frontend assets loading correctly: `GET /asuracore/assets/*` → 200 OK
- ✅ No double `/api/asura` prefix in endpoint bundles
- ✅ API endpoints accessible through Nginx Proxy Manager
- ✅ Login endpoint returning proper response (not 404)

---

## [1.0.0] - 2026-03-01

### Initial Release

- ✨ Core IoT platform with device management
- 📊 Real-time telemetry data visualization
- 🎛️ Dashboard builder with customizable widgets
- 🔐 User authentication with JWT
- 🔌 MQTT device communication
- 📱 Responsive web frontend (React)
- 🚀 Docker containerization
- 📡 Multiple database support (PostgreSQL, InfluxDB)
- 🛡️ Device key authentication

---

## Known Issues

None currently identified.

---

## Migration Guide

### From 1.0.0 to 1.1.0

If you were running an older version and have custom API client code:

**Update your API endpoint calls:**

```javascript
// ❌ OLD (no longer works)
const API_URL = 'https://domain.com/api/asura';
fetch(API_URL + '/api/asura/projects', ...)

// ✅ NEW (correct)
const API_URL = 'https://domain.com/api/asura';
fetch(API_URL + '/projects', ...)
```

No database migration is required.

---

## Development Workflow

### Testing API Changes

When modifying endpoint paths:

1. Update the endpoint definition in `frontend/src/api/index.js`
2. Ensure endpoint path does NOT include `/api/asura`
3. Rebuild frontend:
   ```bash
   docker-compose build --no-cache frontend
   docker-compose up -d frontend
   ```
4. Test in browser Network tab
5. Verify no 404 errors with double paths

### Rebuilding for Deployment

```bash
# Rebuild all services
docker-compose build --no-cache

# Start fresh
docker-compose down
docker-compose up -d

# Verify
docker-compose ps
curl https://your-domain.com/api/asura/health
```

---

## Future Roadmap

- [ ] User role-based access control (RBAC)
- [ ] Advanced widget types (3D visualization, video stream)
- [ ] Device firmware OTA updates
- [ ] Historical data export (CSV, JSON)
- [ ] Alert/notification system
- [ ] Mobile app (React Native)
- [ ] Internationalization (i18n)

---

**Last Updated:** March 24, 2026
