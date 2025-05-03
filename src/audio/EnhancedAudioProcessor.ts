import { AircraftZones } from '../types';

/**
 * EnhancedAudioProcessor provides Fenix-style PA announcements with advanced
 * spatial audio processing and smooth transitions between zones
 */
export class EnhancedAudioProcessor {
  private audioContext: AudioContext;
  private gainNodes: Map<string, GainNode>;
  private convolvers: Map<string, ConvolverNode>;
  private masterGain: GainNode;
  private analyser: AnalyserNode | null = null;
  private fadeIntervals: Map<string, number> = new Map();
  private debugMode: boolean = false;
  
  // Define transition constants
  private CROSSFADE_DURATION_MS = 800; // Smoother, longer crossfades
  private ZONE_TRANSITION_BUFFER = 0.2; // Overlap between zones for smoother transitions
  
  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNodes = new Map();
    this.convolvers = new Map();
    
    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Initialize gain nodes for each zone
    this.initZoneNodes();
    
    // Create convolution reverbs for each zone
    this.initZoneReverbs();
  }
  
  /**
   * Initialize gain nodes for each zone
   */
  private initZoneNodes(): void {
    const zones = ['outside', 'jetway', 'cabin', 'cockpit'];
    
    zones.forEach(zone => {
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.masterGain);
      this.gainNodes.set(zone, gainNode);
    });
  }
  
  /**
   * Initialize convolution reverbs for each zone
   */
  private async initZoneReverbs(): Promise<void> {
    try {
      // Create different reverb characteristics for each zone
      const zones = ['outside', 'jetway', 'cabin', 'cockpit'];
      
      for (const zone of zones) {
        const convolver = this.audioContext.createConvolver();
        
        // Generate synthetic impulse response for each zone
        const impulseResponse = await this.createImpulseResponse(zone);
        convolver.buffer = impulseResponse;
        
        // Connect to zone's gain node
        this.convolvers.set(zone, convolver);
        
        // Get the gain node for this zone
        const gainNode = this.gainNodes.get(zone);
        if (gainNode) {
          // Insert convolver between gain node and master
          gainNode.disconnect();
          gainNode.connect(convolver);
          convolver.connect(this.masterGain);
        }
      }
    } catch (error) {
      console.error('Error initializing zone reverbs:', error);
    }
  }
  
  /**
   * Create synthetic impulse response for different zones
   */
  private async createImpulseResponse(zone: string): Promise<AudioBuffer> {
    // Create different reverb profiles for each zone
    let duration = 2.0; // Base duration in seconds
    let decay = 0.8;    // Base decay factor
    
    switch(zone) {
      case 'outside':
        duration = 0.5; // Less reverb outside
        decay = 0.5;
        break;
      case 'jetway':
        duration = 1.0; // Some reverb in jetway
        decay = 0.6;
        break;
      case 'cabin':
        duration = 3.0; // More reverb in cabin
        decay = 0.85;
        break;
      case 'cockpit':
        duration = 1.5; // Medium reverb in cockpit
        decay = 0.7;
        break;
    }
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);
    
    // Create a realistic impulse response
    for (let i = 0; i < length; i++) {
      // Initial burst followed by exponential decay
      const t = i / sampleRate;
      const amplitude = Math.exp(-t * decay * 5);
      leftChannel[i] = (Math.random() * 2 - 1) * amplitude;
      rightChannel[i] = (Math.random() * 2 - 1) * amplitude;
    }
    
    return impulse;
  }
  
  /**
   * Calculate zone volumes based on position with smooth transitions
   * This is key to the Fenix-style seamless zone transitions
   */
  public updateZoneVolumes(position: number, thresholds: AircraftZones): void {
    try {
      // Calculate volumes for each zone
      const volumes = this.calculateZoneVolumes(position, thresholds);
      
      if (this.debugMode) {
        console.log('EnhancedAudioProcessor - Zone volumes:', volumes);
      }
      
      // Apply volumes with smooth transitions
      Object.entries(volumes).forEach(([zone, targetVolume]) => {
        this.fadeZoneVolume(zone, targetVolume);
      });
    } catch (error) {
      console.error('Error updating zone volumes:', error);
    }
  }
  
  /**
   * Calculate volume for each zone based on position with overlapping transitions
   */
  private calculateZoneVolumes(position: number, thresholds: AircraftZones): Record<string, number> {
    const volumes: Record<string, number> = {
      outside: 0,
      jetway: 0,
      cabin: 0,
      cockpit: 0
    };
    
    // Base volumes for each zone
    const baseVolumes: Record<string, number> = {
      outside: 0.45,
      jetway: 0.792,
      cabin: 0.693,
      cockpit: 0.65
    };
    
    // Calculate each zone's volume
    Object.entries(thresholds).forEach(([zoneName, config]) => {
      // Skip invalid configurations
      if (!config || typeof config.start !== 'number' || typeof config.end !== 'number') {
        return;
      }
      
      // Safely type the zone name
      if (!(zoneName in volumes)) {
        return; // Skip if zone not recognized
      }
      
      // Calculate start and end points with transition buffer
      const transitionStart = Math.min(config.start, config.end) - this.ZONE_TRANSITION_BUFFER;
      const transitionEnd = Math.max(config.start, config.end) + this.ZONE_TRANSITION_BUFFER;
      
      // Determine if position is within this zone's extended range
      if (position >= transitionStart && position <= transitionEnd) {
        // Calculate distance from zone center
        const zoneCenter = (config.start + config.end) / 2;
        const distance = Math.abs(position - zoneCenter);
        const zoneWidth = Math.abs(config.end - config.start) + (this.ZONE_TRANSITION_BUFFER * 2);
        
        // Position within zone (0 = center, 1 = edge)
        const posInZone = distance / (zoneWidth / 2);
        
        // Volume decreases as you move away from center
        // Using a smooth curve function for natural falloff
        const falloffFactor = Math.cos(posInZone * Math.PI / 2);
        
        // Apply zone's base volume and falloff
        volumes[zoneName] = baseVolumes[zoneName] * Math.max(0, falloffFactor);
      }
    });
    
    // Normalize volumes to ensure they sum to 1.0 max
    const sum = Object.values(volumes).reduce((acc, vol) => acc + vol, 0);
    if (sum > 1.0) {
      Object.keys(volumes).forEach(zone => {
        volumes[zone] /= sum;
      });
    }
    
    return volumes;
  }
  
  /**
   * Smoothly fade a zone's volume to target
   */
  private fadeZoneVolume(zone: string, targetVolume: number): void {
    const gainNode = this.gainNodes.get(zone);
    if (!gainNode) return;
    
    // Cancel any ongoing fade for this zone
    if (this.fadeIntervals.has(zone)) {
      window.clearInterval(this.fadeIntervals.get(zone));
    }
    
    const currentTime = this.audioContext.currentTime;
    const currentVolume = gainNode.gain.value;
    
    // If the difference is minimal, just set directly
    if (Math.abs(currentVolume - targetVolume) < 0.01) {
      gainNode.gain.setValueAtTime(targetVolume, currentTime);
      return;
    }
    
    // Perform a smooth linear ramp to the target volume
    // Using Web Audio API's scheduling for better performance
    gainNode.gain.cancelScheduledValues(currentTime);
    gainNode.gain.setValueAtTime(currentVolume, currentTime);
    gainNode.gain.linearRampToValueAtTime(
      targetVolume, 
      currentTime + (this.CROSSFADE_DURATION_MS / 1000)
    );
  }
  
  /**
   * Play audio through the spatial processor with zone-specific processing
   */
  public playAudio(
    source: AudioBufferSourceNode, 
    zone: string, 
    options: { 
      volume?: number, 
      loop?: boolean,
      pitch?: number
    } = {}
  ): void {
    try {
      // Get the gain node for the zone
      const gainNode = this.gainNodes.get(zone);
      if (!gainNode) {
        console.error(`Zone ${zone} not found`);
        return;
      }
      
      // Create a dedicated gain node for this audio instance
      const audioGain = this.audioContext.createGain();
      audioGain.gain.value = options.volume || 1.0;
      
      // Create stereo panner for spatial positioning
      const panner = this.audioContext.createStereoPanner();
      
      // Apply zone-specific panning
      if (zone === 'cockpit') {
        panner.pan.value = 0; // Center in cockpit
      } else if (zone === 'cabin') {
        // Slight randomization for cabin announcements
        panner.pan.value = (Math.random() * 0.4) - 0.2; // -0.2 to 0.2
      }
      
      // Apply pitch modification if specified
      if (options.pitch && options.pitch !== 1.0) {
        source.playbackRate.value = options.pitch;
      }
      
      // Setup loop option
      source.loop = options.loop || false;
      
      // Connect the audio chain
      source.connect(audioGain);
      audioGain.connect(panner);
      panner.connect(gainNode);
      
      // Start the audio
      source.start();
    } catch (error) {
      console.error('Error playing audio through spatial processor:', error);
    }
  }
  
  /**
   * Create an analyzer node for visualizations
   */
  public createAnalyzer(): AnalyserNode {
    if (this.analyser) {
      return this.analyser;
    }
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
    
    return this.analyser;
  }
  
  /**
   * Set master volume
   */
  public setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }
  
  /**
   * Set debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  /**
   * Set cross-fade duration in milliseconds
   */
  public setCrossfadeDuration(durationInSeconds: number): void {
    this.CROSSFADE_DURATION_MS = durationInSeconds * 1000;
  }
  
  /**
   * Get cross-fade duration in seconds
   */
  public getCrossfadeDuration(): number {
    return this.CROSSFADE_DURATION_MS / 1000;
  }
  
  /**
   * Set individual zone volume directly
   */
  public setZoneVolume(zone: string, volume: number): void {
    const gainNode = this.gainNodes.get(zone);
    if (gainNode) {
      const currentTime = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(volume, currentTime);
    }
  }
  
  /**
   * Get gain node for a specific zone
   */
  public getZoneVolume(zone: string): number {
    const gainNode = this.gainNodes.get(zone);
    return gainNode ? gainNode.gain.value : 0;
  }
} 