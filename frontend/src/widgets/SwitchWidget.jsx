import { useState, useEffect } from 'react';
import { devicesApi, telemetryApi } from '../api';
import { Power } from 'lucide-react';

/**
 * SwitchWidget - Bidirectional switch control
 * 
 * Supports both:
 * 1. Reading state from device telemetry (ESP sends state)
 * 2. Sending commands to device (Dashboard controls)
 * 
 * Channel is unified - same channel for reading and writing
 */
export default function SwitchWidget({ widget, device, config, onTelemetry }) {
  const [isOn, setIsOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const channelKey = widget.channel_key;

  // Load initial state from telemetry
  useEffect(() => {
    if (!device?.id || channelKey === undefined) return;
    
    async function loadInitialState() {
      try {
        const res = await telemetryApi.getLatest(device.id, channelKey);
        if (res.data) {
          setIsOn(res.data.value > 0);
          setLastUpdate(new Date(res.data.timestamp));
        }
      } catch (error) {
        console.error('Error loading switch state:', error);
      }
    }
    
    loadInitialState();
  }, [device?.id, channelKey]);

  // Listen for real-time telemetry updates (device sends state back)
  useEffect(() => {
    if (!device?.id || channelKey === undefined || !onTelemetry) return;

    const unsubscribe = onTelemetry(device.id, channelKey, (data) => {
      setIsOn(data.value > 0);
      setLastUpdate(new Date(data.timestamp || Date.now()));
      setSending(false); // Clear sending state when device confirms
    });

    return unsubscribe;
  }, [device?.id, channelKey, onTelemetry]);

  async function toggleSwitch() {
    if (!device || sending) return;
    
    setSending(true);
    
    try {
      // Send command to device using channel number
      const newState = isOn ? 0 : 1;
      const command = { [channelKey]: newState };
      await devicesApi.sendCommand(device.id, command);
      
      // Optimistic update - will be confirmed by telemetry
      setIsOn(!isOn);
      
      // Timeout to clear sending state if device doesn't respond
      setTimeout(() => setSending(false), 500);
    } catch (error) {
      console.error('Error sending command:', error);
      setSending(false);
    }
  }

  if (!device) {
    return <div className="text-gray-400 text-sm">No device selected</div>;
  }

  const label = config.label || `Channel ${channelKey}`;
  const onLabel = config.onLabel || 'ON';
  const offLabel = config.offLabel || 'OFF';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <button
        onClick={toggleSwitch}
        disabled={sending || !device.is_online}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          isOn 
            ? 'bg-green-500 shadow-lg shadow-green-500/30' 
            : 'bg-gray-600 hover:bg-gray-500'
        } ${sending ? 'opacity-50 animate-pulse' : ''} ${!device.is_online ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        <Power className={`w-8 h-8 ${isOn ? 'text-white' : 'text-gray-300'}`} />
      </button>
      
      <span className={`mt-3 text-sm font-medium ${isOn ? 'text-green-400' : 'text-gray-400'}`}>
        {sending ? 'Sending...' : (isOn ? onLabel : offLabel)}
      </span>
      
      {!device.is_online && (
        <span className="text-xs text-red-400 mt-1">Device offline</span>
      )}
      
      {lastUpdate && (
        <span className="text-xs text-gray-500 mt-1">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
