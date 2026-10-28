// Tiny synthesised sound effects with the Web Audio API: no audio files to
// load. Sounds only ever play after the player has done something, and can
// be turned off.
let context: AudioContext | null = null

function tone(frequency: number, start: number, duration: number, volume = 0.12) {
  context ??= new AudioContext()
  const ctx = context
  const time = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, time)
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(volume, time + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time)
  osc.stop(time + duration + 0.05)
}

export const sounds = {
  pin: () => tone(880, 0, 0.12, 0.08),
  reveal: (score: number) => {
    // A rising arpeggio: more notes the better the guess
    const notes = [523, 659, 784, 1047]
    const count = score >= 4000 ? 4 : score >= 2000 ? 3 : score > 0 ? 2 : 1
    notes.slice(0, count).forEach((f, i) => tone(f, i * 0.09, 0.25))
  },
  finish: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.4, 0.1)),
}
