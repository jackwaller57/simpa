import React from 'react';
import './FlightStatusPanel.css';

interface FlightStatusPanelProps {
  flightState: {
    xPosition: number;
    yPosition: number;
    zPosition: number;
    speed: number;
    heading: number;
    altitude?: number;
    cameraViewType: string;
    beaconLight: boolean;
    seatbeltSign: boolean;
    jetwayMoving: boolean;
    jetwayState: number;
    wingLight: boolean;
    aircraftType?: string;
  };
  landingLights: boolean;
  onReset?: () => void;
  onWingLightToggle?: () => void;
  onLandingLightsToggle?: () => void;
}

const FlightStatusPanel: React.FC<FlightStatusPanelProps> = ({
  flightState,
  landingLights,
  onReset,
  onWingLightToggle,
  onLandingLightsToggle
}) => {
  return (
    <div className="flight-status-panel">
      <h3>Flight Status</h3>
      
      <div className="status-grid">
        <div className="status-item">
          <span className="status-label">Aircraft Type:</span>
          <span className="status-value">{flightState.aircraftType || 'Unknown'}</span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Heading:</span>
          <span className="status-value">{flightState.heading.toFixed(1)}°</span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Speed:</span>
          <span className="status-value">{flightState.speed.toFixed(1)} kts</span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Altitude:</span>
          <span className="status-value">
            {flightState.altitude ? `${flightState.altitude.toFixed(0)} ft` : 'N/A'}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Beacon Light:</span>
          <span className={`status-value ${flightState.beaconLight ? 'status-on' : 'status-off'}`}>
            {flightState.beaconLight ? 'ON' : 'OFF'}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Wing Light:</span>
          <span className={`status-value ${flightState.wingLight ? 'status-on' : 'status-off'}`}>
            {flightState.wingLight ? 'ON' : 'OFF'}
          </span>
          {onWingLightToggle && (
            <button className="control-button" onClick={onWingLightToggle}>
              Toggle
            </button>
          )}
        </div>

        <div className="status-item">
          <span className="status-label">Landing Lights:</span>
          <span className={`status-value ${landingLights ? 'status-on' : 'status-off'}`}>
            {landingLights ? 'ON' : 'OFF'}
          </span>
          {onLandingLightsToggle && (
            <button className="control-button" onClick={onLandingLightsToggle}>
              Toggle
            </button>
          )}
        </div>
        
        <div className="status-item">
          <span className="status-label">Seatbelt Sign:</span>
          <span className={`status-value ${flightState.seatbeltSign ? 'status-on' : 'status-off'}`}>
            {flightState.seatbeltSign ? 'ON' : 'OFF'}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Jetway:</span>
          <span className="status-value">
            {flightState.jetwayState ? 'Attached' : 'Detached'}
            {flightState.jetwayMoving && <span className="moving-indicator"> (Moving)</span>}
          </span>
        </div>
      </div>
      
      {onReset && (
        <button className="reset-button" onClick={onReset}>
          Reset Status
        </button>
      )}
    </div>
  );
};

export default FlightStatusPanel; 