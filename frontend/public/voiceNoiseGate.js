/** Low-level room-noise gate for PCM16 frames; the provider still detects speech. */
export class VoiceNoiseGate {
  constructor(frameMs = 50, { openThreshold = 0.006, confirmationFrames = 2 } = {}) {
    this.minimumOpenThreshold = openThreshold;
    this.confirmationFrames = confirmationFrames;
    this.noiseFloor = 0.001;
    this.open = false;
    this.confirmedFrames = 0;
    this.tailFrames = 0;
    this.aboveCloseFrames = 0;
    this.holdFrames = Math.ceil(250 / frameMs);
    this.previous = null;
  }

  filter(frame) {
    let energy = 0;
    for (const sample of frame) energy += (sample / 32768) ** 2;
    const rms = Math.sqrt(energy / frame.length);
    const openThreshold = Math.max(this.minimumOpenThreshold, Math.min(0.02, this.noiseFloor * 3));
    const closeThreshold = Math.max(0.003, Math.min(0.012, this.noiseFloor * 1.8));
    const wasOpen = this.open;

    if (this.open) {
      this.aboveCloseFrames = rms >= closeThreshold ? this.aboveCloseFrames + 1 : 0;
      this.tailFrames -= 1;
      if (this.aboveCloseFrames >= 2) this.tailFrames = this.holdFrames;
      if (this.tailFrames <= 0) this.open = false;
    } else {
      // Two sustained frames reject isolated clicks. Keep one frame of audio
      // so opening the gate does not remove the first consonant of speech.
      this.confirmedFrames = rms >= openThreshold ? this.confirmedFrames + 1 : 0;
      if (this.confirmedFrames >= this.confirmationFrames) {
        this.open = true;
        this.tailFrames = this.holdFrames;
        this.aboveCloseFrames = 2;
        this.confirmedFrames = 0;
      } else if (rms < openThreshold) {
        // Learn only quiet frames, never train the noise estimate on speech.
        const weight = rms < this.noiseFloor ? 0.1 : 0.02;
        this.noiseFloor += weight * (rms - this.noiseFloor);
      }
    }

    const output = this.previous || new Int16Array(frame.length);
    this.previous = frame;
    if (!wasOpen && !this.open) output.fill(0);
    // Never stop sending frames: silence is how the provider ends a turn.
    return output;
  }
}
