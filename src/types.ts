export interface ZoneThreshold {
  start: number;
  end: number;
  threshold?: number;
}

export interface AircraftZones {
  outside: ZoneThreshold;
  jetway: ZoneThreshold;
  cabin: ZoneThreshold;
  cockpit: ZoneThreshold;
}

export interface AircraftConfig {
  zones: AircraftZones;
}

export type AircraftConfigs = {
  [key: string]: AircraftConfig;
};

export interface AudioState {
  masterVolume: number;
  currentZone: string;
  zoneVolumes: Record<string, number>;
  debugMode?: boolean;
  fadeDuration?: number;
  effects?: {
    reverb: boolean;
    delay: boolean;
    compression: boolean;
  };
}

export interface AudioManager {
  initialize(): Promise<void>;
  loadAudio(name: string, url: string): Promise<void>;
  playAudio(name: string, zone: string, options?: {
    loop?: boolean;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
  }): any;
  updateZoneVolumes(zone: string, position: number, thresholds: AircraftZones): void;
  updateZoneVolumesSpatial(position: number, thresholds: AircraftZones, fadeDuration?: number): void;
  setMasterVolume(volume: number): void;
  setDebugMode(enabled: boolean): void;
  getAudioState(): AudioState;
  getGainNode(zone: string): GainNode | undefined;
  getAudioContext(): AudioContext;
  setFadeDuration(duration: number): void;
  getFadeDuration(): number;
  toggleEffect(effect: 'reverb' | 'delay' | 'compression'): void;
  createAnalyzer(): AnalyserNode;
}

// Add Window interface for ipcRenderer
declare global {
  interface Window {
    ipcRenderer?: {
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
  }
} 