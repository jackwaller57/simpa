import React, { useState, useEffect } from 'react';
import { EnhancedAudioProcessor } from '../audio/EnhancedAudioProcessor';
import AudioControls from './AudioControls';

const AudioControlsDemo: React.FC = () => {
  const [audioContext] = useState<AudioContext>(() => new (window.AudioContext || (window as any).webkitAudioContext)());
  const [audioProcessor] = useState<EnhancedAudioProcessor>(() => new EnhancedAudioProcessor(audioContext));
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Resume audio context on user interaction (needed for Safari)
    const resumeAudioContext = () => {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      document.removeEventListener('click', resumeAudioContext);
    };
    document.addEventListener('click', resumeAudioContext);
    
    // Initialize with default thresholds
    const defaultThresholds = {
      outside: { start: 0.0, end: -1.6 },
      jetway: { start: -1.6, end: -12.0 },
      cabin: { start: -12.0, end: -22.4 },
      cockpit: { start: -22.4, end: -24.3 }
    };
    
    // Update with default position
    audioProcessor.updateZoneVolumes(0, defaultThresholds);
    setIsInitialized(true);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', resumeAudioContext);
    };
  }, [audioContext, audioProcessor]);

  // Create a simple test tone when the button is clicked
  const playTestTone = () => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    
    // Create a gain node to control the volume
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Lower volume
    
    // Connect oscillator to gain node
    oscillator.connect(gainNode);
    
    // Play through audio processor
    const zone = 'cabin'; // Default zone to test
    audioProcessor.playAudio(oscillator as unknown as AudioBufferSourceNode, zone, { 
      volume: 0.5,
      loop: false
    });
    
    // Start and stop the oscillator
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 2000); // Play for 2 seconds
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', margin: '20px 0' }}>Audio Controls Demo</h2>
      
      {isInitialized ? (
        <>
          <AudioControls audioProcessor={audioProcessor} />
          
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <button 
              onClick={playTestTone}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4a9eff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Play Test Tone
            </button>
            <p style={{ fontSize: '14px', color: '#666', margin: '10px 0' }}>
              Click the button to test volume controls with a simple tone
            </p>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          Initializing audio system...
        </div>
      )}
    </div>
  );
};

export default AudioControlsDemo; 