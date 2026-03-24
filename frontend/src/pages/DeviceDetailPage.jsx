import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { devicesApi, telemetryApi } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  ArrowLeft,
  Copy,
  RefreshCw,
  Send,
  Activity
} from 'lucide-react';

// Channel range 0-29
const CHANNELS = Array.from({ length: 30 }, (_, i) => i);
const PREVIEW_CHANNELS = [0, 1, 2, 3, 4, 5]; // Preview channels for overview

export default function DeviceDetailPage() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [telemetryData, setTelemetryData] = useState({});
  const { subscribe, onTelemetry, onStatus } = useWebSocket();

  useEffect(() => {
    loadDevice();
  }, [id]);

  useEffect(() => {
    if (device) {
      subscribe(device.id);

      // Listen for telemetry on channels 0-5 for preview
      const unsubscribes = PREVIEW_CHANNELS.map(channel => 
        onTelemetry(device.id, channel, (data) => {
          setTelemetryData(prev => ({
            ...prev,
            [channel]: { value: data.value, timestamp: data.timestamp }
          }));
        })
      );

      const unsubStatus = onStatus(device.id, (data) => {
        setDevice(prev => prev ? { ...prev, is_online: data.online } : prev);
      });

      return () => {
        unsubscribes.forEach(unsub => unsub());
        unsubStatus();
      };
    }
  }, [device?.id]);

  async function loadDevice() {
    try {
      const data = await devicesApi.get(id);
      setDevice(data.device);

      // Load latest telemetry for preview channels
      const telemetryPromises = PREVIEW_CHANNELS.map(async (channel) => {
        try {
          const res = await telemetryApi.getLatest(id, channel);
          return { channel, data: res.data };
        } catch {
          return { channel, data: null };
        }
      });

      const results = await Promise.all(telemetryPromises);
      const telemetry = {};
      results.forEach(({ channel, data }) => {
        if (data) {
          telemetry[channel] = { value: data.value, timestamp: data.timestamp };
        }
      });
      setTelemetryData(telemetry);
    } catch (error) {
      console.error('Error loading device:', error);
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

  if (!device) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Device not found</p>
        <Link to="/devices" className="text-asura-400 hover:text-asura-300">
          Back to devices
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/devices" className="p-2 hover:bg-dark-300 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{device.device_name}</h1>
            <span className={'text-xs px-2 py-1 rounded ' + (
              device.is_online 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-gray-500/20 text-gray-400'
            )}>
              {device.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-gray-400 mt-1">{device.project_name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')}>
          Telemetry
        </TabButton>
        <TabButton active={activeTab === 'commands'} onClick={() => setActiveTab('commands')}>
          Commands
        </TabButton>
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Settings
        </TabButton>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <OverviewTab device={device} telemetryData={telemetryData} />
      )}
      {activeTab === 'telemetry' && (
        <TelemetryTab deviceId={device.id} telemetryData={telemetryData} />
      )}
      {activeTab === 'commands' && (
        <CommandsTab device={device} />
      )}
      {activeTab === 'settings' && (
        <SettingsTab device={device} onUpdate={loadDevice} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={'pb-3 px-1 text-sm font-medium transition-colors ' + (
        active
          ? 'text-asura-400 border-b-2 border-asura-400'
          : 'text-gray-400 hover:text-gray-300'
      )}
    >
      {children}
    </button>
  );
}

function OverviewTab({ device, telemetryData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Device Info */}
      <div className="card">
        <h2 className="card-header">Device Information</h2>
        <div className="space-y-4">
          <InfoRow label="Device ID" value={device.id} copyable />
          <InfoRow label="Device Key" value={device.device_key} copyable masked />
          <InfoRow label="Status" value={device.is_online ? 'Online' : 'Offline'} />
          <InfoRow label="Project" value={device.project_name} />
          {device.description && (
            <InfoRow label="Description" value={device.description} />
          )}
          <InfoRow label="Created" value={new Date(device.created_at).toLocaleString()} />
          {device.last_seen_at && (
            <InfoRow label="Last Seen" value={new Date(device.last_seen_at).toLocaleString()} />
          )}
        </div>
      </div>

      {/* Live Telemetry */}
      <div className="card">
        <h2 className="card-header flex items-center gap-2">
          <Activity className="w-5 h-5 text-asura-400" />
          Live Telemetry
        </h2>
        <div className="space-y-3">
          {Object.keys(telemetryData).length === 0 ? (
            <p className="text-gray-400 text-center py-4">No telemetry data yet</p>
          ) : (
            Object.entries(telemetryData).map(([channel, data]) => (
              <div key={channel} className="flex items-center justify-between p-3 bg-dark-300 rounded-lg">
                <span className="text-gray-400">Channel {channel}</span>
                <span className="text-white font-mono">{data.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyable, masked }) {
  const [copied, setCopied] = useState(false);
  const [showValue, setShowValue] = useState(!masked);

  const displayValue = masked && !showValue 
    ? '••••••••••••••••' 
    : value;

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {masked && (
          <button 
            onClick={() => setShowValue(!showValue)}
            className="text-xs text-asura-400 hover:text-asura-300"
          >
            {showValue ? 'Hide' : 'Show'}
          </button>
        )}
        <span className="text-white text-sm font-mono max-w-[200px] truncate">
          {displayValue}
        </span>
        {copyable && (
          <button onClick={handleCopy} className="p-1 hover:bg-dark-300 rounded">
            <Copy className={'w-4 h-4 ' + (copied ? 'text-green-400' : 'text-gray-400')} />
          </button>
        )}
      </div>
    </div>
  );
}

function TelemetryTab({ deviceId, telemetryData }) {
  const [history, setHistory] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await telemetryApi.getRecent(deviceId, selectedChannel, 50);
      setHistory(data.data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [selectedChannel]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(parseInt(e.target.value))}
          className="input-field w-auto"
        >
          {CHANNELS.map(ch => (
            <option key={ch} value={ch}>Channel {ch}</option>
          ))}
        </select>
        <button onClick={loadHistory} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          Refresh
        </button>
      </div>

      {/* Current Value */}
      {telemetryData[selectedChannel] && (
        <div className="card">
          <h3 className="text-gray-400 text-sm mb-2">Current Value</h3>
          <p className="text-4xl font-bold text-white">{telemetryData[selectedChannel].value}</p>
        </div>
      )}

      {/* History Table */}
      <div className="card">
        <h3 className="text-gray-400 text-sm mb-4">Recent Data (Channel {selectedChannel})</h3>
        {history.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No data for this channel</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 text-sm py-2">Timestamp</th>
                  <th className="text-right text-gray-400 text-sm py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    <td className="py-2 text-gray-300 text-sm">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 text-white text-right font-mono">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CommandsTab({ device }) {
  const [command, setCommand] = useState('{"channel": 10, "value": 1}');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function sendCommand() {
    setSending(true);
    setResult(null);
    try {
      const parsed = JSON.parse(command);
      await devicesApi.sendCommand(device.id, parsed);
      setResult({ success: true, message: 'Command sent successfully' });
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="card-header">Send Command</h2>
        <p className="text-gray-400 text-sm mb-4">
          Send a JSON command to device via MQTT. Format: <code className="text-asura-400">{'{"channel": N, "value": X}'}</code>
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Command (JSON)</label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="input-field font-mono text-sm"
              rows={4}
              placeholder='{"channel": 10, "value": 1}'
            />
          </div>

          {result && (
            <div className={'p-3 rounded-lg ' + (
              result.success 
                ? 'bg-green-500/10 border border-green-500/50 text-green-400' 
                : 'bg-red-500/10 border border-red-500/50 text-red-400'
            )}>
              {result.message}
            </div>
          )}

          <button 
            onClick={sendCommand} 
            disabled={sending || !device.is_online}
            className="btn-primary flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Command'}
          </button>

          {!device.is_online && (
            <p className="text-yellow-400 text-sm">Device is offline. Commands will be delivered when it reconnects.</p>
          )}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="card">
        <h2 className="card-header">Quick Commands</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickCommand label="Channel 10 ON" command='{"channel": 10, "value": 1}' onClick={setCommand} />
          <QuickCommand label="Channel 10 OFF" command='{"channel": 10, "value": 0}' onClick={setCommand} />
          <QuickCommand label="Channel 11 ON" command='{"channel": 11, "value": 1}' onClick={setCommand} />
          <QuickCommand label="Channel 11 OFF" command='{"channel": 11, "value": 0}' onClick={setCommand} />
        </div>
      </div>
    </div>
  );
}

function QuickCommand({ label, command, onClick }) {
  return (
    <button
      onClick={() => onClick(command)}
      className="p-3 bg-dark-300 rounded-lg hover:bg-dark-100 transition-colors text-left"
    >
      <p className="text-white font-medium text-sm">{label}</p>
      <code className="text-gray-400 text-xs">{command}</code>
    </button>
  );
}

function SettingsTab({ device, onUpdate }) {
  const [name, setName] = useState(device.device_name);
  const [description, setDescription] = useState(device.description || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await devicesApi.update(device.id, { device_name: name, description });
      onUpdate();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateKey() {
    if (!confirm('Are you sure? You will need to update your device firmware with the new key.')) {
      return;
    }
    try {
      const data = await devicesApi.regenerateKey(device.id);
      alert('New device key: ' + data.device_key);
      onUpdate();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this device? This cannot be undone.')) {
      return;
    }
    try {
      await devicesApi.delete(device.id);
      window.location.href = '/devices';
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="card-header">Device Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Device Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none"
              rows={3}
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-header">Security</h2>
        <p className="text-gray-400 text-sm mb-4">
          Regenerate the device key if you suspect it has been compromised.
        </p>
        <button onClick={handleRegenerateKey} className="btn-secondary">
          Regenerate Device Key
        </button>
      </div>

      <div className="card border-red-500/50">
        <h2 className="card-header text-red-400">Danger Zone</h2>
        <p className="text-gray-400 text-sm mb-4">
          Permanently delete this device and all its data.
        </p>
        <button onClick={handleDelete} className="btn-danger">
          Delete Device
        </button>
      </div>
    </div>
  );
}
