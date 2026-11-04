// Background music: one looping track, kept quiet under the sound effects.
// The file is only downloaded once it first plays, so it doesn't slow down
// the first load, and it fades in and out instead of starting abruptly.
import trackUrl from './assets/alignment-of-angles.mp3'

const VOLUME = 0.3
const FADE_MS = 800

let audio: HTMLAudioElement | null = null
let fade = 0
// Whether the music should be playing. Checked when a slow start finishes,
// so turning it off while the file is still loading wins.
let wanted = false

// A timer rather than animation frames, which stop in hidden tabs and
// would leave a fade unfinished
function fadeTo(target: number, then?: () => void) {
  if (!audio) return
  const track = audio
  clearInterval(fade)
  const from = track.volume
  const start = performance.now()
  fade = window.setInterval(() => {
    const t = Math.min((performance.now() - start) / FADE_MS, 1)
    track.volume = from + (target - from) * t
    if (t < 1) return
    clearInterval(fade)
    then?.()
  }, 30)
}

export const music = {
  play() {
    wanted = true
    if (!audio) {
      audio = new Audio(trackUrl)
      audio.loop = true
      audio.preload = 'none'
      audio.volume = 0
    }
    // Browsers only allow audio after the player has done something; if
    // it's refused anyway, the game simply carries on without music
    audio.play().then(
      () => (wanted ? fadeTo(VOLUME) : audio?.pause()),
      () => {},
    )
  },
  // Fades out, or stops at once when the tab is hidden
  pause(immediately = false) {
    wanted = false
    const track = audio
    if (!track || track.paused) return
    if (immediately) {
      clearInterval(fade)
      track.pause()
      track.volume = 0
      return
    }
    fadeTo(0, () => {
      if (!wanted) track.pause()
    })
  },
}
