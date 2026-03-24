import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import { dashboardsApi, devicesApi, widgetsApi } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  ArrowLeft,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
  BarChart3,
  Gauge,
  Hash,
  Table,
  ToggleLeft,
  SlidersHorizontal
} from 'lucide-react';

// Widget components
import ChartWidget from '../widgets/ChartWidget';
import GaugeWidget from '../widgets/GaugeWidget';
import SingleValueWidget from '../widgets/SingleValueWidget';
import TableWidget from '../widgets/TableWidget';
import SwitchWidget from '../widgets/SwitchWidget';
import SliderWidget from '../widgets/SliderWidget';

const WIDGET_TYPES = [
  { type: 'chart', label: 'Chart', icon: BarChart3, defaultSize: { w: 4, h: 3 } },
  { type: 'gauge', label: 'Gauge', icon: Gauge, defaultSize: { w: 2, h: 2 } },
  { type: 'single', label: 'Single Value', icon: Hash, defaultSize: { w: 2, h: 2 } },
  { type: 'table', label: 'Table', icon: Table, defaultSize: { w: 3, h: 3 } },
  { type: 'switch', label: 'Switch', icon: ToggleLeft, defaultSize: { w: 2, h: 2 } },
  { type: 'slider', label: 'Slider', icon: SlidersHorizontal, defaultSize: { w: 3, h: 2 } },
];

export default function DashboardBuilderPage() {
  const { id } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [devices, setDevices] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [layoutChanged, setLayoutChanged] = useState(false);
  const { subscribe, onTelemetry, onStatus } = useWebSocket();

  useEffect(() => {
    loadDashboard();
  }, [id]);

  // Subscribe to WebSocket updates for all devices in widgets
  useEffect(() => {
    const deviceIds = [...new Set(widgets.filter(w => w.device_id).map(w => w.device_id))];
    deviceIds.forEach(deviceId => subscribe(deviceId));
  }, [widgets, subscribe]);

  async function loadDashboard() {
    try {
      const [dashboardRes, devicesRes] = await Promise.all([
        dashboardsApi.get(id),
        devicesApi.list(),
      ]);
      setDashboard(dashboardRes.dashboard);
      setWidgets(dashboardRes.dashboard.widgets || []);
      setDevices(devicesRes.devices || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleLayoutChange = useCallback((newLayout) => {
    setWidgets(prev => prev.map(widget => {
      const layoutItem = newLayout.find(l => l.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          pos_x: layoutItem.x,
          pos_y: layoutItem.y,
          width: layoutItem.w,
          height: layoutItem.h,
        };
      }
      return widget;
    }));
    setLayoutChanged(true);
  }, []);

  async function saveLayout() {
    setSaving(true);
    try {
      const layouts = widgets.map(w => ({
        id: w.id,
        pos_x: w.pos_x,
        pos_y: w.pos_y,
        width: w.width,
        height: w.height,
      }));
      await widgetsApi.updateLayouts(layouts);
      setLayoutChanged(false);
    } catch (error) {
      alert('Error saving layout: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddWidget(widgetData) {
    try {
      const data = await widgetsApi.create({
        dashboard_id: id,
        ...widgetData,
      });
      setWidgets([...widgets, data.widget]);
      setShowAddWidget(false);
    } catch (error) {
      alert('Error creating widget: ' + error.message);
    }
  }

  async function handleUpdateWidget(widgetId, widgetData) {
    try {
      const data = await widgetsApi.update(widgetId, widgetData);
      setWidgets(widgets.map(w => w.id === widgetId ? data.widget : w));
      setEditingWidget(null);
    } catch (error) {
      alert('Error updating widget: ' + error.message);
    }
  }

  async function handleDeleteWidget(widgetId) {
    if (!confirm('Delete this widget?')) return;
    try {
      await widgetsApi.delete(widgetId);
      setWidgets(widgets.filter(w => w.id !== widgetId));
    } catch (error) {
      alert('Error deleting widget: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-asura-500"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Dashboard not found</p>
        <Link to="/dashboards" className="text-asura-400 hover:text-asura-300">
          Back to dashboards
        </Link>
      </div>
    );
  }

  const layout = widgets.map(widget => ({
    i: widget.id,
    x: widget.pos_x || 0,
    y: widget.pos_y || 0,
    w: widget.width || 2,
    h: widget.height || 2,
    minW: 1,
    minH: 1,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/dashboards" className="p-2 hover:bg-dark-300 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{dashboard.name}</h1>
          <p className="text-gray-400 text-sm">{dashboard.project_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddWidget(true)} 
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Widget
          </button>
          {layoutChanged && (
            <button 
              onClick={saveLayout} 
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Grid */}
      {widgets.length === 0 ? (
        <div className="card text-center py-16">
          <BarChart3 className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No widgets yet</h3>
          <p className="text-gray-400 mb-4">Add widgets to visualize your device data</p>
          <button onClick={() => setShowAddWidget(true)} className="btn-primary">
            Add First Widget
          </button>
        </div>
      ) : (
        <div className="bg-dark-300 rounded-lg p-4 min-h-[500px]">
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={1200}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            compactType="vertical"
            preventCollision={false}
          >
            {widgets.map(widget => (
              <div key={widget.id} className="widget-card">
                <WidgetWrapper
                  widget={widget}
                  devices={devices}
                  onEdit={() => setEditingWidget(widget)}
                  onDelete={() => handleDeleteWidget(widget.id)}
                  onTelemetry={onTelemetry}
                  onStatus={onStatus}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddWidget && (
        <WidgetModal
          devices={devices}
          onClose={() => setShowAddWidget(false)}
          onSave={handleAddWidget}
        />
      )}

      {/* Edit Widget Modal */}
      {editingWidget && (
        <WidgetModal
          widget={editingWidget}
          devices={devices}
          onClose={() => setEditingWidget(null)}
          onSave={(data) => handleUpdateWidget(editingWidget.id, data)}
        />
      )}
    </div>
  );
}

function WidgetWrapper({ widget, devices, onEdit, onDelete, onTelemetry, onStatus }) {
  const config = widget.config_json || {};
  const device = devices.find(d => d.id === widget.device_id);

  const commonProps = {
    widget,
    device,
    config,
    onTelemetry,
    onStatus,
  };

  const renderWidget = () => {
    switch (widget.type) {
      case 'chart':
        return <ChartWidget {...commonProps} />;
      case 'gauge':
        return <GaugeWidget {...commonProps} />;
      case 'single':
        return <SingleValueWidget {...commonProps} />;
      case 'table':
        return <TableWidget {...commonProps} />;
      case 'switch':
        return <SwitchWidget {...commonProps} />;
      case 'slider':
        return <SliderWidget {...commonProps} />;
      default:
        return <div className="text-gray-400">Unknown widget type</div>;
    }
  };

  return (
    <>
      <div className="widget-header widget-drag-handle cursor-move">
        <span className="text-sm font-medium text-white truncate">
          {config.label || widget.type}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 hover:bg-dark-400 rounded">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-dark-400 rounded">
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      <div className="widget-content">
        {renderWidget()}
      </div>
    </>
  );
}

function WidgetModal({ widget, devices, onClose, onSave }) {
  const [type, setType] = useState(widget?.type || 'single');
  const [deviceId, setDeviceId] = useState(widget?.device_id || '');
  const [channelKey, setChannelKey] = useState(widget?.channel_key || '0');
  const [config, setConfig] = useState(widget?.config_json || {});
  const [loading, setLoading] = useState(false);

  const selectedType = WIDGET_TYPES.find(t => t.type === type);

  function handleConfigChange(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const data = {
      type,
      device_id: deviceId || null,
      channel_key: channelKey,
      config_json: config,
      pos_x: widget?.pos_x || 0,
      pos_y: widget?.pos_y || 0,
      width: widget?.width || selectedType?.defaultSize?.w || 2,
      height: widget?.height || selectedType?.defaultSize?.h || 2,
    };

    await onSave(data);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-200 rounded-lg border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-dark-200">
          <h2 className="text-lg font-semibold text-white">
            {widget ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-300 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Widget Type */}
          {!widget && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Widget Type</label>
              <div className="grid grid-cols-3 gap-2">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.type}
                    type="button"
                    onClick={() => setType(wt.type)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      type === wt.type
                        ? 'border-asura-500 bg-asura-500/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <wt.icon className={`w-6 h-6 mx-auto mb-1 ${
                      type === wt.type ? 'text-asura-400' : 'text-gray-400'
                    }`} />
                    <span className={`text-xs ${
                      type === wt.type ? 'text-white' : 'text-gray-400'
                    }`}>
                      {wt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Device */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Device</label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="input-field"
            >
              <option value="">Select device...</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.device_name} ({d.project_name})
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          {type !== 'status' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Channel
                {(type === 'switch' || type === 'slider') && (
                  <span className="text-gray-500 font-normal ml-1">(feedback from device)</span>
                )}
              </label>
              <select
                value={channelKey}
                onChange={(e) => setChannelKey(e.target.value)}
                className="input-field"
              >
                {Array.from({ length: 30 }, (_, i) => i).map(ch => (
                  <option key={ch} value={String(ch)}>{ch}</option>
                ))}
              </select>
              {(type === 'switch' || type === 'slider') && (
                <p className="text-xs text-gray-500 mt-1">
                  Widget will sync state when device sends data on this channel
                </p>
              )}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Label</label>
            <input
              type="text"
              value={config.label || ''}
              onChange={(e) => handleConfigChange('label', e.target.value)}
              className="input-field"
              placeholder="Widget label"
            />
          </div>

          {/* Type-specific config */}
          {(type === 'gauge' || type === 'single') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Min</label>
                  <input
                    type="number"
                    value={config.min ?? 0}
                    onChange={(e) => handleConfigChange('min', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max</label>
                  <input
                    type="number"
                    value={config.max ?? 100}
                    onChange={(e) => handleConfigChange('max', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
                <input
                  type="text"
                  value={config.unit || ''}
                  onChange={(e) => handleConfigChange('unit', e.target.value)}
                  className="input-field"
                  placeholder="°C, %, V, etc."
                />
              </div>
            </>
          )}

          {type === 'table' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Row Limit</label>
              <input
                type="number"
                value={config.limit ?? 20}
                onChange={(e) => handleConfigChange('limit', parseInt(e.target.value))}
                className="input-field"
                min={1}
                max={100}
              />
            </div>
          )}

          {type === 'slider' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Min</label>
                  <input
                    type="number"
                    value={config.min ?? 0}
                    onChange={(e) => handleConfigChange('min', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max</label>
                  <input
                    type="number"
                    value={config.max ?? 100}
                    onChange={(e) => handleConfigChange('max', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Step</label>
                  <input
                    type="number"
                    value={config.step ?? 1}
                    onChange={(e) => handleConfigChange('step', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Default Value</label>
                  <input
                    type="number"
                    value={config.defaultValue ?? 50}
                    onChange={(e) => handleConfigChange('defaultValue', parseFloat(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
                  <input
                    type="text"
                    value={config.unit || ''}
                    onChange={(e) => handleConfigChange('unit', e.target.value)}
                    className="input-field"
                    placeholder="%, °C, etc."
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : (widget ? 'Update' : 'Add Widget')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
