import React from 'react';
import './CameraPosition.css';

interface CameraPositionProps {
  position: string;
  xPosition: number;
  yPosition: number;
  zPosition: number;
  currentZone: string;
}

const CameraPosition: React.FC<CameraPositionProps> = ({
  position,
  xPosition,
  yPosition,
  zPosition,
  currentZone
}) => {
  return (
    <div className="camera-position-container">
      <h3>Camera Position</h3>
      <div className="position-grid">
        <div className="position-row">
          <span className="position-label">X (Left/Right):</span>
          <span className="position-value">{xPosition.toFixed(2)}</span>
        </div>
        <div className="position-row">
          <span className="position-label">Y (Front/Back):</span>
          <span className="position-value">{yPosition.toFixed(2)}</span>
        </div>
        <div className="position-row">
          <span className="position-label">Z (Up/Down):</span>
          <span className="position-value">{zPosition.toFixed(2)}</span>
        </div>
        <div className="position-row">
          <span className="position-label">Position:</span>
          <span className="position-value">{position}</span>
        </div>
        <div className="position-row">
          <span className="position-label">Zone:</span>
          <span className="position-value">{currentZone}</span>
        </div>
      </div>
    </div>
  );
};

export default CameraPosition; 