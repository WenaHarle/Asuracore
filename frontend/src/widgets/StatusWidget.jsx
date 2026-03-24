import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Wifi, WifiOff, Clock } from 'lucide-react';

export default function StatusWidget({ widget, device, config }) {
  const [status, setStatus] = useState({ online: false, lastSeen: null });
  
  const { onStatus } = useWebSocket();

  useEffect(() => {
    if (!device) return;

    const unsubscribe = onStatus(device.id, (data) => {
      setStatus({
        online: data.status === 'online',
        lastSeen: new Date()
      });
    });

    return unsubscribe;
  }, [device, onStatus]);

  if (!device) {
    return <div className="text-gray-400 text-sm">No device selected</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
        status.online 
          ? 'bg-green-500/20 border-2 border-green-500' 
          : 'bg-red-500/20 border-2 border-red-500'
      }`}>
        {status.online ? (
          <Wifi className="w-8 h-8 text-green-400" />
        ) : (
          <WifiOff className="w-8 h-8 text-red-400" />
        )}
      </div>
      <span className={`mt-3 text-lg font-semibold ${
        status.online ? 'text-green-400' : 'text-red-400'
      }`}>
        {status.online ? 'Online' : 'Offline'}
      </span>
      {status.lastSeen && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Last seen: {status.lastSeen.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
