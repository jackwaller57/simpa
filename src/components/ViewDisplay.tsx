import React from 'react';
import './ViewDisplay.css';

interface ViewDisplayProps {
  viewType: string;
  jetwayState: string;
  jetwayMoving: boolean;
}

const ViewDisplay: React.FC<ViewDisplayProps> = ({
  viewType,
  jetwayState,
  jetwayMoving
}) => {
  return (
    <div className="view-display-container">
      <h3>View Information</h3>
      <div className="view-display-row">
        <span className="view-display-label">Camera View:</span>
        <span className="view-display-value">{viewType || 'Unknown'}</span>
      </div>
      <div className="view-display-row">
        <span className="view-display-label">Jetway:</span>
        <span className="view-display-value">
          {jetwayState}
          {jetwayMoving && <span className="jetway-moving"> (Moving)</span>}
        </span>
      </div>
    </div>
  );
};

export default ViewDisplay; 