import React, { useState, useEffect, useRef } from 'react';
import { EnhancedAudioProcessor } from '../audio/EnhancedAudioProcessor';
import { AircraftZones } from '../types';
import AudioControls from './AudioControls';
import './FenixStylePA.css';

interface FenixStylePAProps {
  currentZone: string;
  position: number;
  thresholds: AircraftZones;
}

const FenixStylePA: React.FC<FenixStylePAProps> = ({
  currentZone,
  position,
  thresholds
}) => {
  const [audioContext] = useState<AudioContext>(() => new (window.AudioContext || (window as any).webkitAudioContext)());
  const [audioProcessor] = useState<EnhancedAudioProcessor>(() => new EnhancedAudioProcessor(audioContext));
  const [announcements, setAnnouncements] = useState<{[key: string]: AudioBuffer}>({});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const announcementFiles = {
    welcome: '/audio/welcome_aboard.mp3',
    seatbelt: '/audio/fasten_seatbelt.mp3',
    descent: '/audio/descent.mp3',
    landing: '/audio/landing_soon.mp3',
    arrived: '/audio/weve_arrived.mp3',
    safety: '/audio/safety_video.mp3'
  };
  
  // Initialize audio processor and load audio files
  useEffect(() => {
    // Resume audio context on user interaction (needed for Safari)
    const resumeAudioContext = () => {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      document.removeEventListener('click', resumeAudioContext);
    };
    document.addEventListener('click', resumeAudioContext);
    
    // Load audio files
    const loadAudio = async () => {
      const totalFiles = Object.keys(announcementFiles).length;
      let loadedFiles = 0;
      
      const newAnnouncements: {[key: string]: AudioBuffer} = {};
      
      for (const [name, url] of Object.entries(announcementFiles)) {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          newAnnouncements[name] = audioBuffer;
          loadedFiles++;
          setLoadingProgress(Math.round((loadedFiles / totalFiles) * 100));
        } catch (error) {
          console.error(`Error loading audio file ${name}:`, error);
        }
      }
      
      setAnnouncements(newAnnouncements);
      setIsInitialized(true);
    };
    
    loadAudio();
    
    // Update audio processor with position and thresholds
    audioProcessor.updateZoneVolumes(position, thresholds);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', resumeAudioContext);
    };
  }, [audioContext, audioProcessor]);
  
  // Update zones when position or thresholds change
  useEffect(() => {
    if (isInitialized) {
      audioProcessor.updateZoneVolumes(position, thresholds);
    }
  }, [audioProcessor, position, thresholds, isInitialized]);
  
  // Function to play announcement with Fenix-style spatial processing
  const playAnnouncement = (name: string) => {
    if (!announcements[name]) {
      console.error(`Announcement "${name}" not loaded`);
      return;
    }
    
    if (isPlaying) {
      console.log('Already playing an announcement, finishing current one first');
      return;
    }
    
    // Create a buffer source
    const source = audioContext.createBufferSource();
    source.buffer = announcements[name];
    
    // Set state to playing
    setIsPlaying(true);
    setCurrentAnnouncement(name);
    
    // Play through the audio processor which handles zone transitions
    audioProcessor.playAudio(source, currentZone, { volume: 1.0 });
    
    // Handle when audio finishes
    source.onended = () => {
      setIsPlaying(false);
      setCurrentAnnouncement('');
    };
  };
  
  return (
    <div className="fenix-style-pa">
      <h3>Fenix-Style PA System</h3>
      
      {!isInitialized ? (
        <div className="loading-container">
          <div className="loading-bar">
            <div 
              className="loading-progress" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p>Loading audio files: {loadingProgress}%</p>
        </div>
      ) : (
        <>
          <AudioControls audioProcessor={audioProcessor} />
          
          <div className="announcement-buttons">
            <button 
              onClick={() => playAnnouncement('welcome')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'welcome' ? 'active' : ''}
            >
              Welcome Aboard
            </button>
            <button 
              onClick={() => playAnnouncement('seatbelt')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'seatbelt' ? 'active' : ''}
            >
              Fasten Seatbelt
            </button>
            <button 
              onClick={() => playAnnouncement('descent')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'descent' ? 'active' : ''}
            >
              Descent
            </button>
            <button 
              onClick={() => playAnnouncement('landing')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'landing' ? 'active' : ''}
            >
              Landing Soon
            </button>
            <button 
              onClick={() => playAnnouncement('arrived')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'arrived' ? 'active' : ''}
            >
              We've Arrived
            </button>
            <button 
              onClick={() => playAnnouncement('safety')} 
              disabled={isPlaying}
              className={currentAnnouncement === 'safety' ? 'active' : ''}
            >
              Safety Video
            </button>
          </div>
          
          <div className="status-display">
            <p>Current Zone: <strong>{currentZone}</strong></p>
            <p>Position: <strong>{position.toFixed(2)}</strong></p>
            {isPlaying && (
              <p className="now-playing">
                Now playing: <strong>{currentAnnouncement}</strong>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FenixStylePA; 