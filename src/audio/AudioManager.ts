// Define locally needed types 
interface ZoneThreshold {
  start: number;
  end: number;
  threshold?: number;
}

interface AircraftZones {
  outside: ZoneThreshold;
  jetway: ZoneThreshold;
  cabin: ZoneThreshold;
  cockpit: ZoneThreshold;
}

export class AudioManager {
  private audioContext: AudioContext;
  private gainNodes: Map<string, GainNode>;
  private audioBuffers: Map<string, AudioBuffer>;
  private pannerNodes: Map<string, PannerNode>;
  private currentZone: string;
  private masterVolume: number;
  private debugMode: boolean;
  private fadeDuration: number;
  private effects: {
    reverb: ConvolverNode | null;
    delay: DelayNode | null;
    compressor: DynamicsCompressorNode | null;
  };

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNodes = new Map();
    this.audioBuffers = new Map();
    this.pannerNodes = new Map();
    this.currentZone = 'outside';
    this.masterVolume = 1.0;
    this.debugMode = false;
    this.fadeDuration = 1.5;
    this.effects = {
      reverb: null,
      delay: null,
      compressor: null
    };
  }

  // Initialize audio system
  public async initialize() {
    try {
      // Create master gain node
      const masterGain = this.audioContext.createGain();
      masterGain.connect(this.audioContext.destination);
      this.gainNodes.set('master', masterGain);

      // Create zone-specific gain nodes
      ['outside', 'jetway', 'cabin', 'cockpit'].forEach(zone => {
        const gainNode = this.audioContext.createGain();
        gainNode.connect(masterGain);
        this.gainNodes.set(zone, gainNode);
      });

      // Initialize audio effects
      this.initializeEffects();

      console.log('Audio system initialized successfully');
    } catch (error) {
      console.error('Error initializing audio system:', error);
    }
  }

  // Load audio file
  public async loadAudio(name: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(name, audioBuffer);
      console.log(`Audio loaded: ${name}`);
    } catch (error) {
      console.error(`Error loading audio ${name}:`, error);
    }
  }

  // Play audio in specific zone
  public playAudio(name: string, zone: string, options: {
    loop?: boolean;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
  } = {}) {
    const buffer = this.audioBuffers.get(name);
    if (!buffer) {
      console.error(`Audio buffer not found: ${name}`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop || false;

    // Create gain node for this specific audio instance
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = options.volume || 1.0;

    // Create panner node for 3D positioning
    const pannerNode = this.audioContext.createPanner();
    this.updatePannerPosition(pannerNode, zone);

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.gainNodes.get(zone)!);

    // Handle fade in
    if (options.fadeIn) {
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        options.volume || 1.0,
        this.audioContext.currentTime + options.fadeIn
      );
    }

    // Handle fade out
    if (options.fadeOut) {
      source.addEventListener('ended', () => {
        gainNode.gain.linearRampToValueAtTime(
          0,
          this.audioContext.currentTime + options.fadeOut!
        );
      });
    }

    source.start();
    return { source, gainNode, pannerNode };
  }

  // Update zone volumes
  public updateZoneVolumes(zone: string, position: number, thresholds: AircraftZones) {
    this.currentZone = zone;
    const zoneGain = this.gainNodes.get(zone);
    if (!zoneGain) return;

    try {
      // Safety check for valid inputs
      if (!thresholds || !thresholds[zone as keyof AircraftZones]) {
        console.warn(`Invalid thresholds for zone: ${zone}`);
        return;
      }

      // Calculate volume based on position within zone
      const volume = this.calculateZoneVolume(zone, position, thresholds);
      
      // Check if volume is a valid, finite number
      if (typeof volume !== 'number' || !isFinite(volume)) {
        console.warn(`Invalid volume value (${volume}) for zone: ${zone}`);
        return;
      }
      
      if (this.debugMode) {
        console.log(`Updating ${zone} volume:`, {
          position,
          volume,
          thresholds: thresholds[zone as keyof AircraftZones]
        });
      }

      // Set the volume with a valid value
      zoneGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    } catch (error) {
      console.error(`Error updating zone volume for ${zone}:`, error);
    }
  }

  // Calculate volume based on position within zone
  private calculateZoneVolume(zone: string, position: number, thresholds: AircraftZones): number {
    try {
      const zoneConfig = thresholds[zone as keyof AircraftZones];
      
      // Safety checks for valid inputs
      if (!zoneConfig || typeof zoneConfig.start !== 'number' || typeof zoneConfig.end !== 'number') {
        console.warn(`Invalid zone configuration for ${zone}`);
        return 0.5; // Fallback to a default value
      }
      
      // Handle the case where start and end are the same (avoid division by zero)
      if (zoneConfig.start === zoneConfig.end) {
        const baseVolumes = {
          outside: 0.45,
          jetway: 0.8,
          cabin: 0.7,
          cockpit: 0.65
        };
        return baseVolumes[zone as keyof typeof baseVolumes] || 0.5;
      }
      
      const distance = Math.abs(position - zoneConfig.start);
      const zoneWidth = Math.abs(zoneConfig.end - zoneConfig.start);
      
      // Protect against division by zero
      if (zoneWidth === 0) {
        return 0.5; // Fallback to a default value
      }
      
      const normalizedDistance = Math.min(1, Math.max(0, distance / zoneWidth));

      // Base volumes for each zone
      const baseVolumes = {
        outside: { min: 0.3, max: 0.45 },
        jetway: { min: 0.6, max: 0.8 },
        cabin: { min: 0.5, max: 0.7 },
        cockpit: { min: 0.4, max: 0.65 }
      };

      const { min, max } = baseVolumes[zone as keyof typeof baseVolumes] || { min: 0.3, max: 0.7 };
      
      // Calculate volume and ensure it's a finite number
      const calculatedVolume = min + (max - min) * (1 - normalizedDistance);
      return isFinite(calculatedVolume) ? calculatedVolume : 0.5;
    } catch (error) {
      console.error(`Error calculating volume for ${zone}:`, error);
      return 0.5; // Fallback to a default value in case of error
    }
  }

  // Update panner position based on zone
  private updatePannerPosition(panner: PannerNode, zone: string) {
    const positions = {
      outside: { x: 0, y: 0, z: 10 },
      jetway: { x: 0, y: 0, z: 5 },
      cabin: { x: 0, y: 0, z: 0 },
      cockpit: { x: 0, y: 0, z: -5 }
    };

    const pos = positions[zone as keyof typeof positions];
    panner.setPosition(pos.x, pos.y, pos.z);
  }

  // Set master volume
  public setMasterVolume(volume: number) {
    this.masterVolume = volume;
    const masterGain = this.gainNodes.get('master');
    if (masterGain) {
      masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  // Toggle debug mode
  public setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  // Get current audio state
  public getAudioState() {
    const zoneVolumes: Record<string, number> = {};
    
    // Convert gain nodes to volume values
    this.gainNodes.forEach((node, zone) => {
      if (zone !== 'master') {
        zoneVolumes[zone] = node.gain.value;
      }
    });
    
    return {
      currentZone: this.currentZone,
      masterVolume: this.masterVolume,
      zoneVolumes
    };
  }

  // Get gain node for a specific zone
  public getGainNode(zone: string): GainNode | undefined {
    return this.gainNodes.get(zone);
  }

  // Get audio context
  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  // Create and connect an analyzer node for visualizing audio
  public createAnalyzer(): AnalyserNode {
    try {
      // Create analyzer node
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      // Connect to master output (non-destructively)
      const masterGain = this.gainNodes.get('master');
      if (masterGain) {
        // Create a gain node to act as a splitter
        const splitter = this.audioContext.createGain();
        splitter.gain.value = 1.0;
        
        // Connect analyzer to the splitter
        splitter.connect(analyser);
        
        // Connect the master to the splitter
        masterGain.connect(splitter);
      } else {
        console.warn('Master gain node not found for analyzer');
      }
      
      return analyser;
    } catch (error) {
      console.error('Error creating analyzer:', error);
      return this.audioContext.createAnalyser(); // Fallback
    }
  }

  // Set fade duration
  public setFadeDuration(duration: number): void {
    this.fadeDuration = duration;
  }

  // Get fade duration
  public getFadeDuration(): number {
    return this.fadeDuration;
  }

  // Initialize audio effects
  private async initializeEffects() {
    // Create reverb effect
    this.effects.reverb = this.audioContext.createConvolver();
    const reverbBuffer = await this.createReverbBuffer();
    this.effects.reverb.buffer = reverbBuffer;

    // Create delay effect
    this.effects.delay = this.audioContext.createDelay();
    this.effects.delay.delayTime.value = 0.5;

    // Create compressor
    this.effects.compressor = this.audioContext.createDynamicsCompressor();
    this.effects.compressor.threshold.value = -24;
    this.effects.compressor.knee.value = 30;
    this.effects.compressor.ratio.value = 12;
    this.effects.compressor.attack.value = 0.003;
    this.effects.compressor.release.value = 0.25;
  }

  // Create reverb buffer
  private async createReverbBuffer(): Promise<AudioBuffer> {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      leftChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      rightChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }

    return buffer;
  }

  // Toggle audio effect
  public toggleEffect(effect: 'reverb' | 'delay' | 'compression'): void {
    switch (effect) {
      case 'reverb':
        if (this.effects.reverb) {
          this.effects.reverb.disconnect();
          this.effects.reverb = null;
        } else {
          this.effects.reverb = this.audioContext.createConvolver();
          this.createReverbBuffer().then(buffer => {
            if (this.effects.reverb) {
              this.effects.reverb.buffer = buffer;
            }
          });
        }
        break;

      case 'delay':
        if (this.effects.delay) {
          this.effects.delay.disconnect();
          this.effects.delay = null;
        } else {
          this.effects.delay = this.audioContext.createDelay();
          this.effects.delay.delayTime.value = 0.5;
        }
        break;

      case 'compression':
        if (this.effects.compressor) {
          this.effects.compressor.disconnect();
          this.effects.compressor = null;
        } else {
          this.effects.compressor = this.audioContext.createDynamicsCompressor();
          this.effects.compressor.threshold.value = -24;
          this.effects.compressor.knee.value = 30;
          this.effects.compressor.ratio.value = 12;
          this.effects.compressor.attack.value = 0.003;
          this.effects.compressor.release.value = 0.25;
        }
        break;
    }

    // Reconnect all audio nodes with updated effects chain
    this.reconnectAudioNodes();
  }

  // Reconnect audio nodes with effects
  private reconnectAudioNodes() {
    // Disconnect all nodes
    this.gainNodes.forEach(node => node.disconnect());
    this.pannerNodes.forEach(node => node.disconnect());

    // Reconnect with effects
    this.gainNodes.forEach((gainNode, zone) => {
      let lastNode: AudioNode = gainNode;

      // Apply effects in chain
      if (this.effects.reverb) {
        lastNode.connect(this.effects.reverb);
        lastNode = this.effects.reverb;
      }

      if (this.effects.delay) {
        lastNode.connect(this.effects.delay);
        lastNode = this.effects.delay;
      }

      if (this.effects.compressor) {
        lastNode.connect(this.effects.compressor);
        lastNode = this.effects.compressor;
      }

      // Connect to destination
      lastNode.connect(this.audioContext.destination);
    });
  }
} 