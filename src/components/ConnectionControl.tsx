import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ConnectionControl.css';

interface ConnectionControlProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ConnectionControl: React.FC<ConnectionControlProps> = ({
  isConnected,
  onConnect,
  onDisconnect
}) => {
  return (
    <div className="connection-control">
      <h3>Connection Control</h3>
      
      <div className="connection-status">
        <span className="status-label">Status:</span>
        <span className={`status-value ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="connection-buttons">
        <button 
          className="connect-button"
          onClick={onConnect}
          disabled={isConnected}
        >
          Connect to SimConnect
        </button>
        
        <button 
          className="disconnect-button"
          onClick={onDisconnect}
          disabled={!isConnected}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default ConnectionControl; 