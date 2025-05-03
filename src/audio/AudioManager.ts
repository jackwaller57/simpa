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
  // Add a variable to track currently active transitions
  private activeTransitions: Map<string, number>;
  // Define transition buffer constant (overlap between zones)
  private readonly ZONE_TRANSITION_BUFFER = 0.2;

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
    // Initialize transitions map
    this.activeTransitions = new Map();
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

      // Initialize standard audio effects
      await this.initializeEffects();
      
      // Initialize zone-specific reverbs for enhanced spatial audio
      await this.initializeZoneReverbs();

      console.log('Audio system initialized successfully with enhanced spatial audio');
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
    try {
      // Validate volume value
      if (typeof volume !== 'number' || !isFinite(volume)) {
        console.warn(`Invalid master volume value: ${volume}`);
        return;
      }
      
      // Store the volume value
      this.masterVolume = volume;
      
      // Apply the volume to the master gain node
      const masterGain = this.gainNodes.get('master');
      if (masterGain) {
        const currentTime = this.audioContext.currentTime;
        
        // Schedule smooth transition to avoid clicks
        masterGain.gain.cancelScheduledValues(currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, currentTime);
        masterGain.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
        
        if (this.debugMode) {
          console.log(`Master volume set to ${Math.round(volume * 100)}%`);
        }
      } else {
        console.warn('Master gain node not found');
      }
    } catch (error) {
      console.error('Error setting master volume:', error);
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

  /**
   * Enhanced method for updating zone volumes with smoother spatial transitions
   * This method is inspired by the Fenix-style PA system
   */
  public updateZoneVolumesSpatial(position: number, thresholds: AircraftZones, fadeDuration: number = this.fadeDuration): void {
    try {
      // Calculate volumes for all zones based on position
      const volumes = this.calculateSpatialZoneVolumes(position, thresholds);
      
      if (this.debugMode) {
        console.log('Spatial zone volumes:', volumes);
      }
      
      // Apply volumes with smooth transitions to all zones
      Object.entries(volumes).forEach(([zone, targetVolume]) => {
        this.smoothlyTransitionZoneVolume(zone, targetVolume, fadeDuration);
      });
      
      // Update current zone based on position
      // Find the zone with the highest volume
      let maxVolume = -1;
      let maxVolumeZone = this.currentZone;
      
      Object.entries(volumes).forEach(([zone, volume]) => {
        if (volume > maxVolume) {
          maxVolume = volume;
          maxVolumeZone = zone;
        }
      });
      
      // Update current zone if changed
      if (maxVolumeZone !== this.currentZone) {
        this.currentZone = maxVolumeZone;
        
        // Apply zone-specific reverb when zone changes
        this.applyZoneReverb(this.currentZone);
        
        if (this.debugMode) {
          console.log(`Zone changed to: ${this.currentZone} with appropriate reverb`);
        }
      }
    } catch (error) {
      console.error('Error updating spatial zone volumes:', error);
    }
  }
  
  /**
   * Calculate volume for each zone based on position with overlapping transitions
   */
  private calculateSpatialZoneVolumes(position: number, thresholds: AircraftZones): Record<string, number> {
    const volumes: Record<string, number> = {
      outside: 0,
      jetway: 0,
      cabin: 0,
      cockpit: 0
    };
    
    // Base volumes for each zone (can be adjusted)
    const baseVolumes: Record<string, number> = {
      outside: 0.45,
      jetway: 0.8,
      cabin: 0.7,
      cockpit: 0.65
    };
    
    // Calculate each zone's volume with overlap
    Object.entries(thresholds).forEach(([zoneName, config]) => {
      // Skip invalid configurations
      if (!config || typeof config.start !== 'number' || typeof config.end !== 'number') {
        return;
      }
      
      // Ensure zoneName is a key in volumes
      if (!(zoneName in volumes)) {
        return;
      }
      
      // Calculate extended boundaries with transition buffer
      const zoneStart = Math.min(config.start, config.end);
      const zoneEnd = Math.max(config.start, config.end);
      const extendedStart = zoneStart - this.ZONE_TRANSITION_BUFFER;
      const extendedEnd = zoneEnd + this.ZONE_TRANSITION_BUFFER;
      
      // Check if position is within extended zone boundaries
      if (position >= extendedStart && position <= extendedEnd) {
        // Calculate distance from zone center
        const zoneCenter = (zoneStart + zoneEnd) / 2;
        const zoneWidth = Math.abs(zoneEnd - zoneStart);
        const extendedWidth = zoneWidth + (this.ZONE_TRANSITION_BUFFER * 2);
        
        // Calculate normalized position within zone (0 = center, 1 = edge)
        const distanceFromCenter = Math.abs(position - zoneCenter);
        const normalizedPos = Math.min(1, distanceFromCenter / (extendedWidth / 2));
        
        // Use cosine curve for smoother falloff (1 at center, 0 at edge)
        const falloff = Math.cos(normalizedPos * Math.PI / 2);
        
        // Apply base volume and falloff
        volumes[zoneName] = baseVolumes[zoneName as keyof typeof baseVolumes] * Math.max(0, falloff);
      }
    });
    
    // Normalize volumes if their sum exceeds 1.0
    const totalVolume = Object.values(volumes).reduce((sum, vol) => sum + vol, 0);
    if (totalVolume > 1.0) {
      Object.keys(volumes).forEach(zone => {
        volumes[zone] /= totalVolume;
      });
    }
    
    return volumes;
  }
  
  /**
   * Apply smooth volume transition to a zone
   */
  private smoothlyTransitionZoneVolume(zone: string, targetVolume: number, fadeDuration: number): void {
    const gainNode = this.gainNodes.get(zone);
    if (!gainNode) return;
    
    const currentTime = this.audioContext.currentTime;
    const currentVolume = gainNode.gain.value;
    
    // Skip if the change is negligible
    if (Math.abs(currentVolume - targetVolume) < 0.01) {
      return;
    }
    
    // Cancel any scheduled values for this gain node
    gainNode.gain.cancelScheduledValues(currentTime);
    
    // Set current value at current time
    gainNode.gain.setValueAtTime(currentVolume, currentTime);
    
    // Smoothly transition to target volume
    gainNode.gain.linearRampToValueAtTime(
      targetVolume,
      currentTime + fadeDuration
    );
    
    // Clear any previous transition timeout
    if (this.activeTransitions.has(zone)) {
      window.clearTimeout(this.activeTransitions.get(zone));
    }
    
    // Add a timeout to track when this transition completes
    const timeoutId = window.setTimeout(() => {
      this.activeTransitions.delete(zone);
      
      if (this.debugMode) {
        console.log(`Transition for ${zone} completed. Volume: ${targetVolume.toFixed(2)}`);
      }
    }, fadeDuration * 1000);
    
    this.activeTransitions.set(zone, timeoutId);
  }

  /**
   * Creates zone-specific reverb impulse responses for more realistic spatial audio
   * This enhances the sense of space in different aircraft zones
   */
  private async initializeZoneReverbs(): Promise<void> {
    try {
      if (!this.effects.reverb) {
        // Create the convolver node first
        this.effects.reverb = this.audioContext.createConvolver();
      }
      
      // Generate zone-specific impulse responses
      const zones = ['outside', 'jetway', 'cabin', 'cockpit'];
      
      for (const zone of zones) {
        // Create reverb characteristics specific to each zone
        const impulseResponse = await this.createZoneImpulseResponse(zone);
        
        // Store the impulse response in the audio buffer for later use
        this.audioBuffers.set(`reverb_${zone}`, impulseResponse);
      }
      
      console.log('Zone-specific reverbs initialized');
    } catch (error) {
      console.error('Error initializing zone reverbs:', error);
    }
  }
  
  /**
   * Create custom impulse response for each zone with different acoustic properties
   */
  private async createZoneImpulseResponse(zone: string): Promise<AudioBuffer> {
    // Create different reverb profiles for each zone
    let duration = 2.0; // Base duration in seconds
    let decay = 0.5;    // Base decay factor
    let earlyReflections = 0.7; // Base early reflections strength
    
    // Configure zone-specific reverb characteristics
    switch(zone) {
      case 'outside':
        duration = 0.5; // Short reverb outside
        decay = 0.2;
        earlyReflections = 0.3;
        break;
      case 'jetway':
        duration = 1.2; // Medium reverb in jetway (enclosed tube)
        decay = 0.5;
        earlyReflections = 0.8; // Strong early reflections in small space
        break;
      case 'cabin':
        duration = 1.8; // Longer reverb in cabin
        decay = 0.7;
        earlyReflections = 0.6;
        break;
      case 'cockpit':
        duration = 0.8; // Shorter, more dampened reverb in cockpit
        decay = 0.45;
        earlyReflections = 0.9; // Strongest early reflections in smallest space
        break;
    }
    
    // Create the impulse response
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);
    
    // Generate a realistic impulse response with early reflections and decay
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      
      // Early reflections (first 50-100ms)
      if (time < 0.1) {
        // Create several discrete reflections
        const reflectionTime = time / 0.1; // Normalize to 0-1 range
        const reflectionStrength = Math.pow(1 - reflectionTime, 2) * earlyReflections;
        
        // Add some randomness to early reflections
        if (i % 400 < 10) {
          leftChannel[i] = (Math.random() * 2 - 1) * reflectionStrength;
          rightChannel[i] = (Math.random() * 2 - 1) * reflectionStrength;
        } else {
          leftChannel[i] = 0;
          rightChannel[i] = 0;
        }
      } 
      // Late reverb tail (exponential decay)
      else {
        const amplitude = Math.exp(-time * decay * 5);
        
        // Decorrelate left and right channels for spaciousness
        leftChannel[i] = (Math.random() * 2 - 1) * amplitude;
        rightChannel[i] = (Math.random() * 2 - 1) * amplitude;
      }
    }
    
    return impulse;
  }
  
  /**
   * Apply zone-specific reverb to audio output
   */
  public applyZoneReverb(zone: string): void {
    if (!this.effects.reverb) return;
    
    // Get the impulse response for this zone
    const impulseResponse = this.audioBuffers.get(`reverb_${zone}`);
    if (!impulseResponse) return;
    
    // Apply the impulse response to the convolver
    this.effects.reverb.buffer = impulseResponse;
    
    if (this.debugMode) {
      console.log(`Applied ${zone}-specific reverb`);
    }
  }
} 