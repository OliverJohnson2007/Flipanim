/**
 * Web Audio API retro sound generator for Windows 95 Flipbook Studio.
 * Fully bulletproof: Uses linear ramps to avoid DOMExceptions and wraps all
 * calls in try/catch to prevent any audio errors from blocking UI interactions.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Classic Win95 mechanical button click
   */
  public playClick(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.setValueAtTime(300, ctx.currentTime + 0.015);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Audio errors must never interrupt UI
    }
  }

  /**
   * Adding a frame: friendly ascending retro arpeggio
   */
  public playAddFrame(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.04);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.04);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.04 + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.04 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.04);
        osc.stop(ctx.currentTime + i * 0.04 + 0.09);
      });
    } catch {
      // Audio errors must never interrupt UI
    }
  }

  /**
   * Deleting a frame: gentle retro descending boop
   */
  public playDeleteFrame(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.11);
    } catch {
      // Audio errors must never interrupt UI
    }
  }

  /**
   * Frame tick during playback or scrubbing
   */
  public playTick(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.02);
    } catch {
      // Audio errors must never interrupt UI
    }
  }

  /**
   * Classic Windows 95 Startup Chime synthesizer simulation
   */
  public playStartupChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const freqs = [155.56, 233.08, 311.13, 392.00, 466.16, 587.33, 698.46, 932.33];

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.2, now);
      masterGain.connect(ctx.destination);

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq + (idx % 2 === 0 ? 0.8 : -0.8), now);

        const delay = idx * 0.1;
        const startTime = now + delay;
        const duration = 2.4 - idx * 0.12;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.06, startTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch {
      // Audio errors must never interrupt UI
    }
  }

  /**
   * Classic Win95 ding / alert
   */
  public playDing(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio errors must never interrupt UI
    }
  }
}

export const soundFx = new SoundManager();
