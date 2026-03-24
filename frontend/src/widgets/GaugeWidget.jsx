import { useState, useEffect } from 'react';
import { telemetryApi } from '../api';

export default function GaugeWidget({ widget, device, config, onTelemetry }) {
  const [value, setValue] = useState(null);

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
      }
    } catch (error) {
      console.error('Error loading gauge data:', error);
    }
  }

  if (!device) {
    return <div className="text-gray-400 text-sm">No device selected</div>;
  }

  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const unit = config.unit || '';
  const percentage = value !== null ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  
  // Calculate color based on percentage
  const getColor = (pct) => {
    if (pct < 30) return '#22c55e'; // green
    if (pct < 70) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  const color = getColor(percentage);
  const angle = -90 + (percentage / 100) * 180;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#374151"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="35"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${angle} 100 100)`}
        />
        {/* Center dot */}
        <circle cx="100" cy="100" r="8" fill="white" />
        
        {/* Min label */}
        <text x="20" y="115" fill="#9CA3AF" fontSize="10" textAnchor="middle">{min}</text>
        {/* Max label */}
        <text x="180" y="115" fill="#9CA3AF" fontSize="10" textAnchor="middle">{max}</text>
      </svg>
      
      <div className="text-center mt-2">
        <div className="text-2xl font-bold text-white">
          {value !== null ? value.toFixed(1) : '--'}
          <span className="text-gray-400 text-sm ml-1">{unit}</span>
        </div>
      </div>
    </div>
  );
}
