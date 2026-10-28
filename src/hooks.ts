import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Counts a number up from 0 with an ease-out, for the score reveal.
// Shows the final number straight away with reduced motion.
export function useCountUp(target: number, durationMs: number, reducedMotion: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (reducedMotion) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reducedMotion])
  return reducedMotion ? target : value
}

// A setting remembered in localStorage, when the browser allows it
export function useStoredBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : stored === 'true'
    } catch {
      return initial
    }
  })
  const update = (next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // Storage blocked - the setting just isn't remembered
    }
  }
  return [value, update] as const
}
