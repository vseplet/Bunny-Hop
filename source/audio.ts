/**
 * Chiptune sound effects using Web Audio API
 */

class AudioManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  public playJump(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Jump sound error:", e);
    }
  }

  public playStart(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Ascending arpeggio
      const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
      const noteLength = 0.08;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * noteLength);

        gain.gain.setValueAtTime(0, ctx.currentTime + i * noteLength);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * noteLength + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * noteLength + noteLength);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * noteLength);
        osc.stop(ctx.currentTime + i * noteLength + noteLength);
      });
    } catch (e) {
      console.warn("Start sound error:", e);
    }
  }

  public playGameOver(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Sad descending notes
      const notes = [392, 330, 262, 196]; // G4, E4, C4, G3
      const noteLength = 0.2;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * noteLength);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * noteLength);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + i * noteLength + noteLength * 0.9
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * noteLength);
        osc.stop(ctx.currentTime + i * noteLength + noteLength);
      });
    } catch (e) {
      console.warn("Game over sound error:", e);
    }
  }

  public playCollect(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Two quick high notes
      const notes = [880, 1100]; // A5, C#6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);

        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.06 + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.1);
      });
    } catch (e) {
      console.warn("Collect sound error:", e);
    }
  }

  public playDeath(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Noise generator
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.0, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("Death sound error:", e);
    }
  }
}

export const audio = new AudioManager();
