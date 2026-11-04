import { playableCountries, usStates, type Place } from './geo'

export const ROUNDS = 5

export type Mode = 'countries' | 'states'

// What changes between guessing countries and guessing US states
export const modes = {
  countries: {
    places: playableCountries,
    noun: 'country',
    plural: 'countries',
    // How forgiving the score is, see scoreFor
    scoreScale: 2000,
    // Where the camera goes when a game starts
    start: { lat: 20, lon: 10, dist: 3 },
  },
  states: {
    places: usStates,
    noun: 'state',
    plural: 'US states',
    scoreScale: 500,
    start: { lat: 40, lon: -100, dist: 1.9 },
  },
} satisfies Record<Mode, unknown>

// Small seeded random number generator (mulberry32), so the daily
// challenge gives everyone the same five places without a backend.
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

// The daily challenge has its own seed per mode. Countries keep the plain
// date, so their challenge didn't change when states were added.
export const dailySeed = (mode: Mode) => (mode === 'countries' ? todayKey() : `${todayKey()}:${mode}`)

export function pickPlaces(mode: Mode, seed: string | null): Place[] {
  const random = seed ? seededRandom(hash(seed)) : Math.random
  const pool = [...modes[mode].places]
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
