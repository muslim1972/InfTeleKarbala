// src/services/RingbackToneGenerator.ts
export class RingbackToneGenerator {
    private audioCtx: AudioContext | null = null;
    private isPlaying = false;
    private intervalId: any = null;
    private currentOscillator: OscillatorNode | null = null;
    private currentGain: GainNode | null = null;

    private readonly FREQUENCY = 425; 
    private readonly TONE_DURATION = 400; 
    private readonly SILENCE_DURATION = 200; 
    private readonly CYCLE_PAUSE = 2000; 
    private readonly VOLUME = 0.15; 

    start(): void {
        if (this.isPlaying) return;

        try {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.isPlaying = true;
            this.playCycle();
        } catch (error) {
            console.error('❌ Failed to start ringback tone:', error);
            this.cleanup();
        }
    }

    private playCycle(): void {
        if (!this.isPlaying || !this.audioCtx) return;

        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        this.playTone(now);

        const secondToneStart = (this.TONE_DURATION + this.SILENCE_DURATION) / 1000;
        this.playTone(now + secondToneStart);

        const cycleDuration = (this.TONE_DURATION * 2 + this.SILENCE_DURATION + this.CYCLE_PAUSE);

        this.intervalId = setTimeout(() => {
            if (this.isPlaying) {
                this.playCycle();
            }
        }, cycleDuration);
    }

    private playTone(startTime: number): void {
        if (!this.audioCtx) return;

        const ctx = this.audioCtx;
        const duration = this.TONE_DURATION / 1000;

        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(this.FREQUENCY, startTime);

        const gainNode = ctx.createGain();

        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(this.VOLUME, startTime + 0.02);

        gainNode.gain.setValueAtTime(this.VOLUME, startTime + duration - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        this.currentOscillator = oscillator;
        this.currentGain = gainNode;
    }

    stop(): void {
        if (!this.isPlaying) return;
        this.cleanup();
    }

    private cleanup(): void {
        this.isPlaying = false;

        if (this.intervalId !== null) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }

        try {
            if (this.currentOscillator) {
                this.currentOscillator.stop();
                this.currentOscillator.disconnect();
                this.currentOscillator = null;
            }
        } catch (e) {}

        try {
            if (this.currentGain) {
                this.currentGain.disconnect();
                this.currentGain = null;
            }
        } catch (e) {}

        if (this.audioCtx) {
            this.audioCtx.close().catch(() => { });
            this.audioCtx = null;
        }
    }

    get playing(): boolean {
        return this.isPlaying;
    }
}

let ringbackInstance: RingbackToneGenerator | null = null;

export const getRingbackTone = (): RingbackToneGenerator => {
    if (!ringbackInstance) {
        ringbackInstance = new RingbackToneGenerator();
    }
    return ringbackInstance;
};

export const startRingback = (): void => getRingbackTone().start();
export const stopRingback = (): void => getRingbackTone().stop();
