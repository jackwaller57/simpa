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
      <div className="view-info-grid">
        <div className="view-info-row">
          <span className="view-info-label">View Type:</span>
          <span className="view-info-value">{viewType}</span>
        </div>
        <div className="view-info-row">
          <span className="view-info-label">Jetway:</span>
          <span className="view-info-value">
            {jetwayState}
            {jetwayMoving && <span className="moving-indicator"> (Moving)</span>}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ViewDisplay; 