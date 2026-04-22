// src/services/GlobalAudioManager.ts
// مدير صوتي عام مع حماية شاملة من التكرار اللانهائي وتجاوز مشاكل التشغيل التلقائي
class GlobalAudioManager {
  private static instance: GlobalAudioManager;

  // Audio Elements
  private currentAudio: HTMLAudioElement | null = null;

  // Web Audio API (Fallback)
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  // State
  private isPlaying = false;
  private isStopping = false;
  private isAlertActive = false; 
  private listeners: Set<() => void> = new Set();
  private alertTimer: any = null;

  private constructor() {}

  static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  async startAlert(): Promise<void> {
    try {
      this.stopAllAudio();
      this.isAlertActive = true; 

      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      this.currentAudio = new Audio();
      this.currentAudio.src = '/sounds/ringing_old_phone.mp3';
      this.currentAudio.loop = true;
      this.currentAudio.volume = 0.8;

      this.currentAudio.addEventListener('ended', () => {
        this.notifyListeners();
      });

      this.currentAudio.addEventListener('error', (error) => {
        if (!this.isAlertActive) return;
        console.warn('🔊 Audio file error (switching to fallback):', error);
        this.playFallbackTone();
      });

      try {
        await this.currentAudio.play();
        this.isPlaying = true;
        this.isStopping = false;
        this.notifyListeners();
      } catch (playError) {
        console.error('🔊 Global Audio Manager: Play failed:', playError);
        this.isPlaying = false;
        this.notifyListeners();
        throw playError; 
      }

    } catch (error) {
      console.error('🔊 Global Audio Manager: Error in startAlert:', error);
      this.isPlaying = false;
      this.isAlertActive = false; 
      this.notifyListeners();
      throw error;
    }
  }

  private playFallbackTone() {
    if (!this.isAlertActive) return; 

    try {
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.stopOscillator();

      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.type = 'square'; 
      this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime); 

      this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      this.oscillator.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
      this.oscillator.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.2);

      this.gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.oscillator.start();

      const loopTone = () => {
        if (!this.isAlertActive || !this.isPlaying || this.isStopping) return;
        try {
          this.stopOscillator();
          if (this.isAlertActive) this.playFallbackTone();
        } catch (e) { }
      };

      this.alertTimer = setTimeout(loopTone, 1000);
      this.isPlaying = true;
      this.isStopping = false;
      this.notifyListeners();

    } catch (e) {
      console.error('🔊 Fallback tone failed:', e);
    }
  }

  private stopOscillator() {
    if (this.oscillator) {
      try { this.oscillator.stop(); this.oscillator.disconnect(); } catch (e) { }
      this.oscillator = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch (e) { }
      this.gainNode = null;
    }
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
  }

  async resume(): Promise<void> {
    if (!this.isAlertActive) return; 

    if (this.currentAudio) {
      try {
        await this.currentAudio.play();
        this.isPlaying = true;
        this.notifyListeners();
        return;
      } catch (error) {
        console.error('🔊 Global Audio Manager: Resume audio file failed:', error);
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        if (this.isAlertActive && !this.isPlaying && !this.currentAudio) {
          this.playFallbackTone();
        } else if (this.isAlertActive && !this.isPlaying && this.currentAudio) {
          this.currentAudio.play().catch(() => {
            if (this.isAlertActive) this.playFallbackTone();
          });
        }
        if (this.isAlertActive) {
          this.isPlaying = true;
          this.notifyListeners();
        }
      } catch (error) {
        console.error('🔊 Global Audio Manager: Resume AudioContext failed:', error);
      }
    }
  }

  stopAllAudio(): void {
    try {
      this.isAlertActive = false; 

      if (this.isStopping) return;

      this.isStopping = true;

      if (this.alertTimer) {
        clearTimeout(this.alertTimer);
        this.alertTimer = null;
      }

      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
        this.currentAudio = null;
      }

      this.stopOscillator();

      document.querySelectorAll('audio').forEach((audio) => {
        if (!audio.srcObject) { // Don't stop WebRTC streams here, only notification sounds
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
        }
      });

      this.isPlaying = false;

      setTimeout(() => {
        this.notifyListeners();
        this.isStopping = false;
      }, 50);

    } catch (error) {
      console.error('🔊 Global Audio Manager: Error in stop:', error);
      this.isStopping = false;
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try { listener(); } catch (error) {}
    });
  }

  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  getStatus(): { isPlaying: boolean; hasAudio: boolean } {
    return {
      isPlaying: this.isPlaying,
      hasAudio: this.currentAudio !== null || this.oscillator !== null
    };
  }

  reset(): void {
    this.stopAllAudio();
    this.listeners.clear();
    this.isStopping = false;
    this.isPlaying = false;
    this.alertTimer = null;
    this.audioContext = null;
  }
}

export const globalAudioManager = GlobalAudioManager.getInstance();
