import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { RefreshCw, Clock, ChevronDown } from 'lucide-react';
import { telemetryApi } from '../api';

const RANGE_OPTIONS = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '10m', label: '10 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
];

export default function ChartWidget({ widget, device, config, onTelemetry }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRange] = useState(config.range || '1h');
  const [showRangeMenu, setShowRangeMenu] = useState(false);

  const loadData = useCallback(async () => {
    if (!device?.id || widget.channel_key === undefined || widget.channel_key === null) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await telemetryApi.getHistory(device.id, widget.channel_key, range, 1000);
      
      const chartData = (res.data || []).map(d => ({
        timestamp: new Date(d.timestamp).getTime(),
        value: parseFloat(d.value)
      })).sort((a, b) => a.timestamp - b.timestamp);
      
      setData(chartData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[ChartWidget] Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [device?.id, widget.channel_key, range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh based on range
  useEffect(() => {
    const intervalMs = range.includes('m') ? 5000 : 
                       range === '1h' ? 10000 : 
                       range === '6h' ? 30000 : 60000;
    
    const interval = setInterval(loadData, intervalMs);
    return () => clearInterval(interval);
  }, [loadData, range]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!device?.id || !widget.channel_key || !onTelemetry) return;
    
    const unsubscribe = onTelemetry(device.id, widget.channel_key, (newData) => {
      setData(prev => {
        const newPoint = {
          timestamp: newData.timestamp || Date.now(),
          value: parseFloat(newData.value)
        };
        
        // Keep only points within range
        const rangeMs = parseRangeToMs(range);
        const cutoff = Date.now() - rangeMs;
        const filtered = prev.filter(p => p.timestamp > cutoff);
        
        return [...filtered, newPoint].sort((a, b) => a.timestamp - b.timestamp);
      });
      setLastUpdated(new Date());
    });

    return unsubscribe;
  }, [device?.id, widget.channel_key, onTelemetry, range]);

  function parseRangeToMs(r) {
    const match = r.match(/^(\d+)([mhd])$/);
    if (!match) return 3600000;
    const [, num, unit] = match;
    const multipliers = { m: 60000, h: 3600000, d: 86400000 };
    return parseInt(num) * multipliers[unit];
  }

  function formatTime(ts) {
    const date = new Date(ts);
    if (range.includes('m') || range === '1h' || range === '6h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (range === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  const currentRangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label || range;

  if (!device) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No device selected
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-asura-500 mb-2"></div>
        <div className="text-gray-400 text-xs">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="text-red-400 text-sm mb-3">{error}</div>
        <button onClick={loadData} className="px-3 py-1.5 bg-asura-600 hover:bg-asura-500 rounded text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Clock className="h-8 w-8 text-gray-500 mb-2" />
        <div className="text-gray-400 text-sm mb-1">No data</div>
        <div className="text-gray-500 text-xs mb-3">No data recorded for {currentRangeLabel.toLowerCase()}</div>
        <button onClick={loadData} className="px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded text-xs flex items-center gap-2">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const min = Math.min(...values).toFixed(1);
  const max = Math.max(...values).toFixed(1);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const latest = values[values.length - 1].toFixed(1);

  const chartType = config.chartType || 'line';
  const chartColor = config.color || '#0ea5e9';

  return (
    <div className="h-full flex flex-col">
      {/* Header with range selector */}
      <div className="flex items-center justify-between px-2 py-1 text-xs border-b border-dark-600">
        <div className="flex items-center gap-3 text-gray-400">
          <span>Min: <span className="text-blue-400">{min}</span></span>
          <span>Max: <span className="text-red-400">{max}</span></span>
          <span>Avg: <span className="text-green-400">{avg}</span></span>
          <span>Latest: <span className="text-white font-medium">{latest}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {/* Range Selector */}
          <div className="relative">
            <button
              onClick={() => setShowRangeMenu(!showRangeMenu)}
              className="flex items-center gap-1 px-2 py-1 bg-dark-600 hover:bg-dark-500 rounded text-gray-300"
            >
              {currentRangeLabel}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showRangeMenu && (
              <div className="absolute right-0 mt-1 bg-dark-700 border border-dark-500 rounded shadow-lg z-10">
                {RANGE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setRange(option.value);
                      setShowRangeMenu(false);
                    }}
                    className={`block w-full text-left px-3 py-1.5 hover:bg-dark-600 whitespace-nowrap ${
                      range === option.value ? 'text-asura-400' : 'text-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={loadData}
            disabled={loading}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-dark-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={40} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a2234', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                labelFormatter={ts => new Date(ts).toLocaleString()}
                formatter={value => [value.toFixed(2), config.label || 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#gradient-${widget.id})`} />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={40} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a2234', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                labelFormatter={ts => new Date(ts).toLocaleString()}
                formatter={value => [value.toFixed(2), config.label || 'Value']}
              />
              <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chartColor }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="px-2 py-1 text-xs text-gray-500 border-t border-dark-600 flex justify-between">
        <span>{data.length} points</span>
        {lastUpdated && <span>Updated: {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
