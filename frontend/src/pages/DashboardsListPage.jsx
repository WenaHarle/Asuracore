import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardsApi, projectsApi } from '../api';
import { 
  LayoutDashboard, 
  Plus,
  Search
} from 'lucide-react';

export default function DashboardsListPage() {
  const [dashboards, setDashboards] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [dashboardsRes, projectsRes] = await Promise.all([
        dashboardsApi.list(),
        projectsApi.list(),
      ]);
      setDashboards(dashboardsRes.dashboards || []);
      setProjects(projectsRes.projects || []);
    } catch (error) {
      console.error('Error loading dashboards:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDashboards = dashboards.filter(dashboard => {
    if (search && !dashboard.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterProject && dashboard.project_id !== filterProject) {
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
          <h1 className="text-2xl font-bold text-white">Dashboards</h1>
          <p className="text-gray-400 mt-1">Visualize your IoT data</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Dashboard
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
            placeholder="Search dashboards..."
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
      </div>

      {/* Dashboards Grid */}
      {filteredDashboards.length === 0 ? (
        <div className="card text-center py-12">
          <LayoutDashboard className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No dashboards found</h3>
          <p className="text-gray-400 mb-4">
            {dashboards.length === 0 
              ? 'Create your first dashboard to start visualizing data.'
              : 'Try adjusting your filters.'}
          </p>
          {dashboards.length === 0 && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              Create Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              to={`/dashboards/${dashboard.id}`}
              className="card hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <LayoutDashboard className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{dashboard.name}</h3>
                  <p className="text-gray-400 text-sm">{dashboard.project_name}</p>
                </div>
              </div>
              {dashboard.description && (
                <p className="text-gray-400 text-sm line-clamp-2 mb-3">{dashboard.description}</p>
              )}
              <p className="text-gray-500 text-xs">
                {dashboard.widget_count || 0} widgets
              </p>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDashboardModal
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

function AddDashboardModal({ projects, onClose, onSave }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project');
      return;
    }
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
            </>
          )}
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button 
              type="submit" 
              disabled={loading || projects.length === 0} 
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
