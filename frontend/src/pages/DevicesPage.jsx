import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi, projectsApi } from '../api';
import { 
  Cpu, 
  Plus,
  Wifi,
  WifiOff,
  Search,
  Filter
} from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [devicesRes, projectsRes] = await Promise.all([
        devicesApi.list(),
        projectsApi.list(),
      ]);
      setDevices(devicesRes.devices || []);
      setProjects(projectsRes.projects || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDevices = devices.filter(device => {
    if (search && !device.device_name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterProject && device.project_id !== filterProject) {
      return false;
    }
    if (filterStatus === 'online' && !device.is_online) {
      return false;
    }
    if (filterStatus === 'offline' && device.is_online) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-asura-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 mt-1">
            {devices.length} total • {devices.filter(d => d.is_online).length} online
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-12 py-3 border border-gray-600 focus:border-asura-500 focus:outline-none focus:ring-2 focus:ring-asura-500/20 transition"
            placeholder="Search devices..."
          />
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Devices Grid */}
      {filteredDevices.length === 0 ? (
        <div className="card text-center py-12">
          <Cpu className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No devices found</h3>
          <p className="text-gray-400 mb-4">
            {devices.length === 0 
              ? 'Add your first device to start monitoring.'
              : 'Try adjusting your filters.'}
          </p>
          {devices.length === 0 && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              Add Device
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDeviceModal
          projects={projects}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function DeviceCard({ device }) {
  return (
    <Link
      to={`/devices/${device.id}`}
      className="card hover:border-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${device.is_online ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
            {device.is_online ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white">{device.device_name}</h3>
            <p className="text-gray-400 text-sm">{device.project_name}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          device.is_online 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-500/20 text-gray-400'
        }`}>
          {device.is_online ? 'Online' : 'Offline'}
        </span>
      </div>
      
      {device.description && (
        <p className="text-gray-400 text-sm line-clamp-2 mb-3">{device.description}</p>
      )}

      {device.last_seen_at && (
        <p className="text-gray-500 text-xs">
          Last seen: {new Date(device.last_seen_at).toLocaleString()}
        </p>
      )}
    </Link>
  );
}

function AddDeviceModal({ projects, onClose, onSave }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdDevice, setCreatedDevice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project');
      return;
    }
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
            <p className="text-sm text-gray-400 mb-1">Device ID:</p>
            <code className="text-white text-sm break-all">{createdDevice.id}</code>
          </div>
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
          
          {projects.length === 0 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm">
              You need to create a project first.
              <Link to="/projects" className="ml-2 underline">Create Project</Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project *</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input-field"
                  required
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
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
            </>
          )}
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button 
              type="submit" 
              disabled={loading || projects.length === 0} 
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
