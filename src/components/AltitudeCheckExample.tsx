import React, { useState, useEffect } from 'react';
import AltitudeCheck from './AltitudeCheck';

interface FlightData {
  altitude: number;
  // Other flight data properties
}

const AltitudeCheckExample: React.FC = () => {
  const [flightData, setFlightData] = useState<FlightData>({ altitude: 0 });
  const [passed10kFeet, setPassed10kFeet] = useState<boolean>(false);
  
  // This would typically come from your flight data service/store
  useEffect(() => {
    // Example: Subscribe to flight data updates
    const intervalId = setInterval(() => {
      // Mock data update - in real app, you'd get this from SimConnect or other source
      setFlightData(prevData => ({
        ...prevData,
        altitude: Math.random() * 20000 // Random altitude between 0-20000 ft for demo
      }));
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Check altitude and update status automatically
  useEffect(() => {
    if (flightData.altitude > 10000 && !passed10kFeet) {
      setPassed10kFeet(true);
    } else if (flightData.altitude < 10000 && passed10kFeet) {
      setPassed10kFeet(false);
    }
  }, [flightData.altitude, passed10kFeet]);
  
  const handleAltitudeStatusChange = (passed: boolean) => {
    setPassed10kFeet(passed);
    // Here you would also update any other relevant state or trigger actions
    console.log(`Aircraft ${passed ? 'has passed' : 'has not passed'} 10,000 feet`);
  };
  
  return (
    <div className="altitude-check-container">
      <h3>Current Flight Altitude: {Math.round(flightData.altitude)} ft</h3>
      
      <AltitudeCheck
        passed10kFeet={passed10kFeet}
        onStatusChange={handleAltitudeStatusChange}
      />
      
      {/* You could show different UI elements based on the altitude status */}
      {passed10kFeet && (
        <div className="altitude-actions">
          <p>Above 10,000 ft - Cabin service available</p>
        </div>
      )}
    </div>
  );
};

export default AltitudeCheckExample; 