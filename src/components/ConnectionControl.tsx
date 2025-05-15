import React from 'react';
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
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
        <div className="status-text">
          Status: <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="connection-buttons">
        <button 
          className="connect-button" 
          onClick={onConnect}
          disabled={isConnected}
        >
          Connect
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