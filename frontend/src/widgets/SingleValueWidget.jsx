import { useState, useEffect } from 'react';
import { telemetryApi } from '../api';

export default function SingleValueWidget({ widget, device, config, onTelemetry }) {
  const [value, setValue] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  // Load initial value
  useEffect(() => {
    if (device && widget.channel_key) {
      loadLatest();
    }
  }, [device?.id, widget.channel_key]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!device || !widget.channel_key || !onTelemetry) return;
    
    const unsubscribe = onTelemetry(device.id, widget.channel_key, (data) => {
      setValue(data.value);
      setTimestamp(new Date().toISOString());
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [device?.id, widget.channel_key, onTelemetry]);

  async function loadLatest() {
    try {
      const res = await telemetryApi.getLatest(device.id, widget.channel_key);
      if (res.data) {
        setValue(res.data.value);
        setTimestamp(res.data.timestamp);
      }
    } catch (error) {
      console.error('Error loading value:', error);
    }
  }

  if (!device) {
    return <div className="text-gray-400 text-sm">No device selected</div>;
  }

  const unit = config.unit || '';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-4xl font-bold text-white">
        {value !== null ? Number(value).toFixed(1) : '--'}
        <span className="text-gray-400 text-lg ml-1">{unit}</span>
      </div>
      {timestamp && (
        <div className="text-gray-500 text-xs mt-2">
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
