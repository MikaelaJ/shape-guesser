import { cubicOut } from 'svelte/easing'
import { Tween } from 'svelte/motion'

// Counts a number up from 0 with an ease-out, for the score reveal.
// Shows the final number straight away with reduced motion, so there's
// never a frame of 0 first.
export function countUp(target: () => number, duration: number, reducedMotion: () => boolean) {
  const tween = new Tween(0, { duration, easing: cubicOut })
  $effect(() => {
    tween.target = target()
  })
  return {
    get current() {
      return reducedMotion() ? target() : Math.round(tween.current)
    },
  }
}
