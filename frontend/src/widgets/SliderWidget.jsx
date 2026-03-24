import { useState, useEffect } from 'react';
import { devicesApi, telemetryApi } from '../api';

export default function SliderWidget({ widget, device, config, onTelemetry }) {
  const [value, setValue] = useState(config.defaultValue ?? 50);
  const [sending, setSending] = useState(false);
  const channelKey = widget.channel_key;

  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;

  // Load initial value from telemetry
  useEffect(() => {
    if (device && channelKey) {
      loadInitialValue();
    }
  }, [device?.id, channelKey]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!device || !channelKey || !onTelemetry) return;

    const unsubscribe = onTelemetry(device.id, channelKey, (data) => {
      setValue(Number(data.value));
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [device?.id, channelKey, onTelemetry]);

  async function loadInitialValue() {
    try {
      const res = await telemetryApi.getLatest(device.id, channelKey);
      if (res.data && res.data.value !== undefined) {
        setValue(Number(res.data.value));
      }
    } catch (error) {
      console.error('Error loading slider value:', error);
    }
  }

  // Calculate percentage for gradient
  const percentage = ((value - min) / (max - min)) * 100;

  async function handleChange(newValue) {
    setValue(newValue);
  }

  async function handleRelease() {
    if (!device || sending) return;
    
    setSending(true);
    try {
      // Use channel as the command key
      const command = { [channelKey]: value };
      await devicesApi.sendCommand(device.id, command);
    } catch (error) {
      console.error('Error sending command:', error);
    } finally {
      setSending(false);
    }
  }

  if (!device) {
    return <div className="text-gray-400 text-sm text-center">No device selected</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Value display */}
      <div className="text-3xl font-bold text-white mb-4">
        {value}
        {config.unit && <span className="text-lg text-gray-400 ml-1">{config.unit}</span>}
      </div>

      {/* Slider */}
      <div className="w-full">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          className="slider-input w-full"
          style={{
            background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
          }}
          disabled={sending}
        />
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between w-full text-xs text-gray-500 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {/* Status */}
      {sending && (
        <div className="text-xs text-asura-400 mt-2">Sending...</div>
      )}
    </div>
  );
}
