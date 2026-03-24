import { useState, useEffect } from 'react';
import { telemetryApi } from '../api';

export default function TableWidget({ widget, device, config, onTelemetry }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    if (device && widget.channel_key) {
      loadData();
    }
  }, [device?.id, widget.channel_key, config.limit]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!device || !widget.channel_key || !onTelemetry) return;
    
    const unsubscribe = onTelemetry(device.id, widget.channel_key, (newData) => {
      setData(prev => {
        const updated = [
          { value: newData.value, timestamp: new Date().toISOString() },
          ...prev,
        ];
        return updated.slice(0, config.limit || 20);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [device?.id, widget.channel_key, config.limit, onTelemetry]);

  async function loadData() {
    try {
      const res = await telemetryApi.getRecent(
        device.id, 
        widget.channel_key, 
        config.limit || 20
      );
      setData(res.data || []);
    } catch (error) {
      console.error('Error loading table data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!device) {
    return <div className="text-gray-400 text-sm">No device selected</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-asura-500"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-gray-400 text-sm text-center">No data</div>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-dark-300">
          <tr className="border-b border-gray-700">
            <th className="text-left text-gray-400 py-2 px-2">Time</th>
            <th className="text-right text-gray-400 py-2 px-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-700/50">
              <td className="py-1 px-2 text-gray-300">
                {new Date(row.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-1 px-2 text-white text-right font-mono">
                {row.value.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
