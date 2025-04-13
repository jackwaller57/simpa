import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

const CameraPosition: React.FC = () => {
  const [position, setPosition] = useState<CameraPosition>({ x: 0, y: 0, z: 0 });
  const [isInternal, setIsInternal] = useState<boolean>(false);

  useEffect(() => {
    const unlisten = listen('view-changed', (event) => {
      const data = event.payload as { isInternal: boolean };
      setIsInternal(data.isInternal);
    });

    const unlistenPosition = listen('camera-position', (event) => {
      const data = event.payload as CameraPosition;
      setPosition(data);
    });

    return () => {
      unlisten.then(fn => fn());
      unlistenPosition.then(fn => fn());
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 bg-opacity-75 p-4 rounded-lg text-white">
      <h3 className="text-lg font-bold mb-2">Camera Position</h3>
      <div className="grid grid-cols-2 gap-2">
        <span className="font-semibold">X (Left/Right):</span>
        <span>{position.x.toFixed(2)}</span>
        <span className="font-semibold">Y (Front/Back):</span>
        <span>{position.y.toFixed(2)}</span>
        <span className="font-semibold">Z (Up/Down):</span>
        <span>{position.z.toFixed(2)}</span>
        <span className="font-semibold">View Type:</span>
        <span>{isInternal ? 'Internal' : 'External'}</span>
      </div>
    </div>
  );
};

export default CameraPosition; 