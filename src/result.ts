import type { LatLon, Place } from './geo'

// One finished round. guess, nearest and km are null when the time ran out
// without a pin.
export type Result = {
  country: Place
  guess: LatLon | null
  nearest: LatLon | null
  km: number | null
  seconds: number
  score: number
}

export const PORTFOLIO_URL = 'https://mikaelajohansson.com/'
export const GAME_URL = 'https://mikaelajohansson.com/outlinr/'

export const points = (n: number) => n.toLocaleString('en-GB')
export const percent = (factor: number) => `${Math.round(factor * 100)} %`
