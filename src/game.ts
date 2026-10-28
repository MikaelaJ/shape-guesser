import { playableCountries, type Country } from './geo'

export const ROUNDS = 5

// Small seeded random number generator (mulberry32), so the daily
// challenge gives everyone the same five countries without a backend.
function seededRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string) {
  let h = 2166136261
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}

export function todayKey(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function pickCountries(seed: string | null): Country[] {
  const random = seed ? seededRandom(hash(seed)) : Math.random
  const pool = [...playableCountries]
  // Partial Fisher-Yates shuffle: only the first ROUNDS are needed
  for (let i = 0; i < ROUNDS; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, ROUNDS)
}

// Emoji summary for sharing, one square per round
export function scoreSquare(score: number) {
  if (score >= 4000) return '🟩'
  if (score >= 2000) return '🟨'
  return '🟥'
}
