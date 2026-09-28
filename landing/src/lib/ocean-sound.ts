/**
 * The sea, generated live with Web Audio (no audio files): brown noise through a low-pass that swells like waves,
 * a hiss of foam on top, and a thunder rumble on each lightning strike.
 */
export class OceanSound {
  private ctx: AudioContext;
  private master: GainNode;
  private swell: GainNode;
  private foam: GainNode;
  private wind: GainNode;
  private sources: AudioScheduledSourceNode[] = [];

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    const brown = this.noiseBuffer("brown");
    const white = this.noiseBuffer("white");

    this.swell = this.layer(brown, "lowpass", 520, 0.9);
    this.foam = this.layer(white, "bandpass", 2400, 0.05);
    this.wind = this.layer(white, "highpass", 5200, 0);
    this.lfo(this.swell.gain, 0.09, 0.45);
    this.lfo(this.foam.gain, 0.13, 0.04);
  }

  private noiseBuffer(kind: "white" | "brown"): AudioBuffer {
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") data[i] = w;
      else {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buf;
  }

  private layer(buffer: AudioBuffer, type: BiquadFilterType, freq: number, gain: number): GainNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    this.sources.push(src);
    return g;
  }

  private lfo(param: AudioParam, rate: number, depth: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(param);
    osc.start();
    this.sources.push(osc);
  }

  async start(): Promise<void> {
    await this.ctx.resume();
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
  }

  stop(): void {
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** 0 = calm, 1 = storm. */
  setStorm(amount: number): void {
    const t = this.ctx.currentTime;
    this.swell.gain.setTargetAtTime(0.9 + amount * 0.6, t, 0.5);
    this.foam.gain.setTargetAtTime(0.05 + amount * 0.18, t, 0.5);
    this.wind.gain.setTargetAtTime(amount * 0.12, t, 0.5);
  }

  thunder(delaySeconds = 0.6): void {
    const t = this.ctx.currentTime + delaySeconds;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer("brown");
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 2.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.6, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 3.4);
  }

  dispose(): void {
    this.sources.forEach((s) => s.stop());
    void this.ctx.close();
  }
}
