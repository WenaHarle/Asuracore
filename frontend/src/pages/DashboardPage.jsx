import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, devicesApi, dashboardsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  FolderOpen, 
  Cpu, 
  LayoutDashboard, 
  Activity,
  ArrowRight,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    devices: 0,
    dashboards: 0,
    onlineDevices: 0,
  });
  const [recentDevices, setRecentDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [projectsRes, devicesRes, dashboardsRes] = await Promise.all([
        projectsApi.list(),
        devicesApi.list(),
        dashboardsApi.list(),
      ]);

      const devices = devicesRes.devices || [];
      const onlineCount = devices.filter(d => d.is_online).length;

      setStats({
        projects: projectsRes.projects?.length || 0,
        devices: devices.length,
        dashboards: dashboardsRes.dashboards?.length || 0,
        onlineDevices: onlineCount,
      });

      setRecentDevices(devices.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p className="text-gray-400 mt-1">
          Here's an overview of your AsuraCore IoT platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<FolderOpen className="w-6 h-6" />}
          label="Projects"
          value={stats.projects}
          href="/projects"
          color="blue"
        />
        <StatsCard
          icon={<Cpu className="w-6 h-6" />}
          label="Devices"
          value={stats.devices}
          href="/devices"
          color="green"
        />
        <StatsCard
          icon={<Activity className="w-6 h-6" />}
          label="Online"
          value={stats.onlineDevices}
          suffix={`/ ${stats.devices}`}
          color="emerald"
        />
        <StatsCard
          icon={<LayoutDashboard className="w-6 h-6" />}
          label="Dashboards"
          value={stats.dashboards}
          href="/dashboards"
          color="purple"
        />
      </div>

      {/* Quick actions & recent devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="card-header">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/projects"
              className="p-4 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors group"
            >
              <FolderOpen className="w-8 h-8 text-asura-400 mb-2" />
              <span className="text-white font-medium">New Project</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-asura-400 mt-2" />
            </Link>
            <Link
              to="/devices"
              className="p-4 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors group"
            >
              <Cpu className="w-8 h-8 text-green-400 mb-2" />
              <span className="text-white font-medium">Add Device</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-green-400 mt-2" />
            </Link>
            <Link
              to="/dashboards"
              className="p-4 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors group"
            >
              <LayoutDashboard className="w-8 h-8 text-purple-400 mb-2" />
              <span className="text-white font-medium">Create Dashboard</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 mt-2" />
            </Link>
            <Link
              to="/devices"
              className="p-4 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors group"
            >
              <Activity className="w-8 h-8 text-yellow-400 mb-2" />
              <span className="text-white font-medium">View Telemetry</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 mt-2" />
            </Link>
          </div>
        </div>

        {/* Recent Devices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Devices</h2>
            <Link to="/devices" className="text-asura-400 hover:text-asura-300 text-sm">
              View all
            </Link>
          </div>
          
          {recentDevices.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No devices yet</p>
              <Link to="/devices" className="text-asura-400 hover:text-asura-300 text-sm">
                Add your first device
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDevices.map((device) => (
                <Link
                  key={device.id}
                  to={`/devices/${device.id}`}
                  className="flex items-center justify-between p-3 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${device.is_online ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                      {device.is_online ? (
                        <Wifi className="w-4 h-4 text-green-400" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{device.device_name}</p>
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon, label, value, suffix, href, color }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  const content = (
    <div className="card hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-2xl font-bold text-white">
            {value}
            {suffix && <span className="text-gray-400 text-lg font-normal">{suffix}</span>}
          </p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}
