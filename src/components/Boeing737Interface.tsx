import React, { useState, useEffect, useRef } from 'react';
import './Boeing737Interface.css';
import CameraPosition from './CameraPosition';
import ViewDisplay from './ViewDisplay';
import FlightStatusPanel from './FlightStatusPanel';
import AircraftTypeSelector from './AircraftTypeSelector';
import ConnectionControl from './ConnectionControl';
import { AudioControlPanel } from './AudioControlPanel';
import FenixStylePA from './FenixStylePA';
// Import background CSS module
import backgroundStyles from './Boeing737Background.module.css';
// Import the background image
import maxInterfaceImage from '../assets/737max-interface.jpg';

interface Boeing737InterfaceProps {
  // Flight state props
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
  
  // Camera position props
  cameraPosition: string;
  currentZone: string;
  
  // Connection props
  simConnectActive: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  
  // Controls props
  landingLights: boolean;
  onWingLightToggle: () => void;
  onLandingLightsToggle: () => void;
  onSeatbeltSignToggle: () => void;
  
  // Aircraft config props
  selectedAircraftType: string;
  aircraftDetectionMode: string;
  onAircraftTypeChange: (type: string) => void;
  onDetectionModeChange: (mode: string) => void;
  getAircraftConfigs: () => any;
  onZoneConfigChange: (type: string, config: any) => void;
  
  // Audio props
  zoneVolumes: {
    outside: number;
    jetway: number;
    cabin: number;
    cockpit: number;
  };
  masterVolume?: number;
  onMasterVolumeChange?: (volume: number) => void;
  audioControlsProps?: any;
}

// Define audio files for the buttons
const audioFiles = [
  { id: 'boarding-music', name: 'Boarding Music', icon: '🎵' },
  { id: 'welcome-aboard', name: 'Welcome Aboard', icon: '👋' },
  { id: 'doors-auto', name: 'Doors to Auto', icon: '🚪' },
  { id: '10k-feet', name: '10,000 Feet', icon: '✈️' },
  { id: 'arrive-soon', name: 'Arrive Soon', icon: '🛬' },
  { id: 'landing-soon', name: 'Landing Soon', icon: '⏱️' },
  { id: 'weve-arrived', name: 'We\'ve Arrived', icon: '🏁' },
  { id: 'almost-ready', name: 'Almost Ready', icon: '⚙️' },
  { id: 'seats-for-departure', name: 'Seats for Departure', icon: '💺' },
  { id: 'safety-video', name: 'Safety Video', icon: '🔒' },
  { id: 'fasten-seatbelt', name: 'Fasten Seatbelt', icon: '🔔' }
];

// Original image dimensions for mapping coordinates
const ORIGINAL_WIDTH = 600;
const ORIGINAL_HEIGHT = 600;

const Boeing737Interface: React.FC<Boeing737InterfaceProps> = ({
  flightState,
  cameraPosition,
  currentZone,
  simConnectActive,
  onConnect,
  onDisconnect,
  landingLights,
  onWingLightToggle,
  onLandingLightsToggle,
  onSeatbeltSignToggle,
  selectedAircraftType,
  aircraftDetectionMode,
  onAircraftTypeChange,
  onDetectionModeChange,
  getAircraftConfigs,
  onZoneConfigChange,
  zoneVolumes,
  masterVolume = 1,
  onMasterVolumeChange,
  audioControlsProps
}) => {
  const [activeMode, setActiveMode] = useState('Manual');
  const [currentVolume, setCurrentVolume] = useState(masterVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [previousBoardingMusic, setPreviousBoardingMusic] = useState('');
  const [activePage, setActivePage] = useState('Boarding Music');
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<string | null>(null);
  
  // Reference to the image element
  const imageRef = useRef<HTMLImageElement>(null);
  // State to store image dimensions
  const [imageDimensions, setImageDimensions] = useState({ width: ORIGINAL_WIDTH, height: ORIGINAL_HEIGHT });

  // Get the background image based on active mode
  const getBackgroundImage = () => {
    return activeMode === 'Manual' ? '/737FAP manual.png' : '/737FAP maintenance.png';
  };

  // Update image dimensions when the image loads or resizes
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current) {
        setImageDimensions({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };

    // Set initial dimensions
    updateImageDimensions();

    // Add resize event listener
    window.addEventListener('resize', updateImageDimensions);

    // Clean up
    return () => {
      window.removeEventListener('resize', updateImageDimensions);
    };
  }, []);

  useEffect(() => {
    setActivePage(activeMode === 'Manual' ? 'Boarding Music' : 'Aircraft Configuration');
  }, [activeMode]);

  // Function to scale coordinates based on current image size
  const scaleCoords = (coords: string) => {
    const [x1, y1, x2, y2] = coords.split(',').map(Number);
    
    const scaleX = imageDimensions.width / ORIGINAL_WIDTH;
    const scaleY = imageDimensions.height / ORIGINAL_HEIGHT;
    
    return `${Math.round(x1 * scaleX)},${Math.round(y1 * scaleY)},${Math.round(x2 * scaleX)},${Math.round(y2 * scaleY)}`;
  };

  // Volume control handlers
  const handleVolumeDecrease = () => {
    if (currentVolume > 0.05) {
      const newVolume = Math.max(0, currentVolume - 0.1);
      setCurrentVolume(newVolume);
      if (onMasterVolumeChange) onMasterVolumeChange(newVolume);
    }
  };

  const handleVolumeIncrease = () => {
    if (currentVolume < 0.95) {
      const newVolume = Math.min(1, currentVolume + 0.1);
      setCurrentVolume(newVolume);
      if (onMasterVolumeChange) onMasterVolumeChange(newVolume);
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (onMasterVolumeChange) {
      if (!isMuted) {
        // Muting
        setCurrentVolume(masterVolume);
        onMasterVolumeChange(0);
      } else {
        // Unmuting
        onMasterVolumeChange(currentVolume);
      }
    }
  };

  const handlePlayAudio = (audioId: string) => {
    // Find the audio element
    const audioElement = document.getElementById(audioId) as HTMLAudioElement;
    
    // Stop all audio first
    audioFiles.forEach(file => {
      const element = document.getElementById(file.id) as HTMLAudioElement;
      if (element && element !== audioElement) {
        element.pause();
        element.currentTime = 0;
      }
    });
    
    // If this is the currently playing audio, stop it
    if (currentAudio === audioId && audioElement && !audioElement.paused) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setCurrentAudio(null);
      return;
    }
    
    // Otherwise play the audio
    if (audioElement) {
      audioElement.volume = currentVolume;
      audioElement.currentTime = 0;
      audioElement.play().then(() => {
        setCurrentAudio(audioId);
        setSelectedAnnouncement(audioId);
      }).catch(err => {
        console.error('Error playing audio:', err);
      });
    }
  };

  // Handle click on the mode tabs
  const handleModeTabClick = (mode: string) => {
    setActiveMode(mode);
  };
  
  // Render the maintenance content
  const renderMaintenanceContent = () => {
    return (
      <div className="maintenance-content">
        <div className="control-columns">
          <div className="control-column">
            {/* Program selection panel - now has audio files */}
            <div className="content-panel">
              <h3 className="panel-header">Audio Controls</h3>
              <div className="program-selection">
                <div className="audio-controls-grid">
                  {audioFiles.map(file => (
                    <button 
                      key={file.id}
                      className={`audio-button ${currentAudio === file.id ? 'playing' : ''}`}
                      onClick={() => handlePlayAudio(file.id)}
                    >
                      <span className="audio-button-icon">{file.icon}</span>
                      <span className="audio-button-text">{file.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Status panel */}
            <div className="content-panel">
              <h3 className="panel-header">Flight Status</h3>
              <FlightStatusPanel
                flightState={flightState}
                landingLights={landingLights}
                onWingLightToggle={onWingLightToggle}
                onLandingLightsToggle={onLandingLightsToggle}
                onSeatbeltSignToggle={onSeatbeltSignToggle}
              />
            </div>
            
            {/* Connection control */}
            <div className="content-panel">
              <h3 className="panel-header">Connection</h3>
              <ConnectionControl 
                isConnected={simConnectActive}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            </div>
          </div>
          
          <div className="control-column">
            {/* Now Playing panel */}
            <div className="content-panel now-playing-panel">
              <h3 className="panel-header">Now Playing</h3>
              
              {/* Camera Position */}
              <CameraPosition
                position={cameraPosition}
                xPosition={flightState.xPosition}
                yPosition={flightState.yPosition}
                zPosition={flightState.zPosition}
                currentZone={currentZone}
              />
              
              {/* View Display */}
              <ViewDisplay
                viewType={flightState.cameraViewType}
                jetwayState={flightState.jetwayState ? "Attached" : "Detached"}
                jetwayMoving={flightState.jetwayMoving}
              />
              
              {/* Media controls */}
              <div className="media-controls">
                <button className="media-button" onClick={() => {
                  if (currentAudio) {
                    const audioElement = document.getElementById(currentAudio) as HTMLAudioElement;
                    if (audioElement) {
                      audioElement.pause();
                      audioElement.currentTime = 0;
                      setCurrentAudio(null);
                    }
                  }
                }}>■</button>
                <button className="media-button play-pause" onClick={() => {
                  if (selectedAnnouncement) {
                    handlePlayAudio(selectedAnnouncement);
                  }
                }}>▶</button>
              </div>
            </div>
            
            {/* Aircraft Configuration */}
            <div className="content-panel">
              <h3 className="panel-header">Aircraft Configuration</h3>
              <AircraftTypeSelector
                currentAircraftType={selectedAircraftType}
                detectedAircraftType={flightState.aircraftType}
                onAircraftTypeChange={onAircraftTypeChange}
                detectionMode={aircraftDetectionMode}
                onDetectionModeChange={onDetectionModeChange}
                aircraftConfigs={getAircraftConfigs()}
                onZoneConfigChange={onZoneConfigChange}
                currentZone={currentZone}
                zoneVolumes={zoneVolumes}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render interactive audio buttons for manual mode
  const renderManualAudioButtons = () => {
    // Scale positions based on current image dimensions
    const scalePosition = (value: number, isHorizontal: boolean) => {
      const scale = isHorizontal 
        ? imageDimensions.width / ORIGINAL_WIDTH 
        : imageDimensions.height / ORIGINAL_HEIGHT;
      return value * scale;
    };
    
    // Position the buttons over the "Select Program" area in the image
    return (
      <div className="manual-audio-buttons">
        {audioFiles.map((file, index) => {
          if (index < 6) { // Display at most 6 buttons
            return (
              <button 
                key={file.id}
                className={`manual-audio-button ${currentAudio === file.id ? 'playing' : ''}`}
                onClick={() => handlePlayAudio(file.id)}
                style={{
                  top: `${scalePosition(219 + index * 45, false)}px`, // Position buttons based on row
                  left: `${scalePosition(87, true)}px`,
                  width: `${scalePosition(466, true)}px`,
                  height: `${scalePosition(35, false)}px`
                }}
              >
                {file.name}
              </button>
            );
          }
          return null;
        })}
      </div>
    );
  };
  
  return (
    <div className="boeing-interface-image-container">
      {/* The main image that serves as the interactive interface */}
      <img 
        ref={imageRef}
        src={getBackgroundImage()} 
        alt={`737 FAP ${activeMode} Interface`}
        className="boeing-interface-image" 
        useMap="#737max-interface-map"
      />
      
      {/* Image map for clickable areas - these are scaled dynamically */}
      <map name="737max-interface-map">
        {/* Mode tabs */}
        <area 
          shape="rect" 
          coords={scaleCoords("138,80,215,110")}
          alt="Manual Mode" 
          onClick={() => handleModeTabClick('Manual')}
          className="clickable-area"
        />
        <area 
          shape="rect" 
          coords={scaleCoords("270,80,380,110")}
          alt="Maintenance Mode" 
          onClick={() => handleModeTabClick('Maintenance')}
          className="clickable-area"
        />
        
        {/* Back button */}
        <area 
          shape="rect" 
          coords={scaleCoords("50,135,130,168")}
          alt="Back Button" 
          onClick={() => console.log('Back button clicked')}
          className="clickable-area"
        />
        
        {/* Volume controls */}
        <area 
          shape="rect" 
          coords={scaleCoords("371,552,396,577")}
          alt="Mute" 
          onClick={handleMuteToggle}
          className="clickable-area"
        />
        <area 
          shape="rect" 
          coords={scaleCoords("407,552,435,577")}
          alt="Volume Down" 
          onClick={handleVolumeDecrease}
          className="clickable-area"
        />
        <area 
          shape="rect" 
          coords={scaleCoords("446,552,476,577")}
          alt="Volume Up" 
          onClick={handleVolumeIncrease}
          className="clickable-area"
        />
      </map>
      
      {/* Render interactive audio buttons for manual mode */}
      {activeMode === 'Manual' && renderManualAudioButtons()}
      
      {/* Render maintenance content if in maintenance mode */}
      {activeMode === 'Maintenance' && renderMaintenanceContent()}
      
      {/* Display current mode and status as an overlay */}
      <div className="interface-status-overlay">
        <p>Mode: {activeMode}</p>
        <p>Current Zone: {currentZone}</p>
        <p>Volume: {Math.round(currentVolume * 100)}%</p>
        {currentAudio && (
          <p>Playing: {audioFiles.find(file => file.id === currentAudio)?.name}</p>
        )}
      </div>
    </div>
  );
};

export default Boeing737Interface; 