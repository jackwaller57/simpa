import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export class AudioManager {
    private static instance: AudioManager;

    private constructor() {
        this.setupEventListeners();
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private async setupEventListeners() {
        await listen('play_sound', async (event: any) => {
            const soundPath = event.payload as string;
            await this.playSound(soundPath);
        });
    }

    public async playSound(path: string) {
        try {
            await invoke('play_sound', { path });
        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    }

    public async stopSound() {
        try {
            await invoke('stop_sound');
        } catch (error) {
            console.error('Failed to stop sound:', error);
        }
    }
} 