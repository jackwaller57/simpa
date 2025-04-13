import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

interface ViewDisplayProps {
  className?: string;
}

export default function ViewDisplay({ className = '' }: ViewDisplayProps) {
  const [currentView, setCurrentView] = useState<string>('');

  useEffect(() => {
    const unlisten = listen('view-changed', (event) => {
      const payload = event.payload as { view: string };
      setCurrentView(payload.view);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    <div className={`bg-gray-800 text-white p-2 rounded-lg ${className}`}>
      <div className="text-sm font-semibold">Current View:</div>
      <div className="text-lg">{currentView || 'Loading...'}</div>
    </div>
  );
} 