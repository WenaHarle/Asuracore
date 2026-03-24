import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, devicesApi, dashboardsApi } from '../api';
import { 
  ArrowLeft,
  Cpu, 
  LayoutDashboard,
  Plus,
  Wifi,
  WifiOff,
  Settings
} from 'lucide-react';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [devices, setDevices] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('devices');

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    try {
      const [projectRes, devicesRes, dashboardsRes] = await Promise.all([
        projectsApi.get(id),
        devicesApi.list(id),
        dashboardsApi.list(id),
      ]);
      setProject(projectRes.project);
      setDevices(devicesRes.devices || []);
      setDashboards(dashboardsRes.dashboards || []);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-asura-500"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Project not found</p>
        <Link to="/projects" className="text-asura-400 hover:text-asura-300">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="p-2 hover:bg-dark-300 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && (
            <p className="text-gray-400 mt-1">{project.description}</p>
          )}
        </div>
        <Link to={`/projects/${id}/settings`} className="btn-secondary flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'devices'
              ? 'text-asura-400 border-b-2 border-asura-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Devices ({devices.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('dashboards')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'dashboards'
              ? 'text-asura-400 border-b-2 border-asura-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboards ({dashboards.length})
          </div>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'devices' && (
        <DevicesTab projectId={id} devices={devices} onUpdate={loadProject} />
      )}
      {activeTab === 'dashboards' && (
        <DashboardsTab projectId={id} dashboards={dashboards} onUpdate={loadProject} />
      )}
    </div>
  );
}

function DevicesTab({ projectId, devices, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="card text-center py-12">
          <Cpu className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-4">No devices in this project</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Add First Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Link
              key={device.id}
              to={`/devices/${device.id}`}
              className="card hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${device.is_online ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                  {device.is_online ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">{device.device_name}</h3>
                  <span className={`text-xs ${device.is_online ? 'text-green-400' : 'text-gray-400'}`}>
                    {device.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              {device.description && (
                <p className="text-gray-400 text-sm line-clamp-2">{device.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDeviceModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

function DashboardsTab({ projectId, dashboards, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Dashboard
        </button>
      </div>

      {dashboards.length === 0 ? (
        <div className="card text-center py-12">
          <LayoutDashboard className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-4">No dashboards in this project</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Create First Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              to={`/dashboards/${dashboard.id}`}
              className="card hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <LayoutDashboard className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-medium text-white">{dashboard.name}</h3>
              </div>
              <p className="text-gray-400 text-sm">
                {dashboard.widget_count || 0} widgets
              </p>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDashboardModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

function AddDeviceModal({ projectId, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdDevice, setCreatedDevice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await devicesApi.create(projectId, name, description);
      setCreatedDevice(data.device);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (createdDevice) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-dark-200 rounded-lg border border-gray-700 w-full max-w-md p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Device Created!</h2>
          <p className="text-gray-400 mb-4">
            Save this device key - you'll need it to configure your ESP32/Arduino firmware.
          </p>
          <div className="bg-dark-400 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-400 mb-1">Device Key:</p>
            <code className="text-asura-400 text-sm break-all">{createdDevice.device_key}</code>
          </div>
          <button onClick={onSave} className="btn-primary w-full">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-200 rounded-lg border border-gray-700 w-full max-w-md">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Add Device</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Device Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="ESP32 Living Room"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddDashboardModal({ projectId, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await dashboardsApi.create(projectId, name, description);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-200 rounded-lg border border-gray-700 w-full max-w-md">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Create Dashboard</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dashboard Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Main Dashboard"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
