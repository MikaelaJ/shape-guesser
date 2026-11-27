import { describe, expect, it } from 'vitest'
import { pickPlaces, ROUND_SECONDS, ROUNDS, scoreSquare, speedFactor, todayKey } from './game'
import { allPlaces, placeName } from './geo'

describe('speedFactor', () => {
  it('keeps all points at once and half when time runs out', () => {
    expect(speedFactor(0)).toBe(1)
    expect(speedFactor(ROUND_SECONDS / 2)).toBe(0.75)
    expect(speedFactor(ROUND_SECONDS)).toBe(0.5)
  })

  it("doesn't drop below half after the time is up", () => {
    expect(speedFactor(ROUND_SECONDS * 3)).toBe(0.5)
  })
})

describe('todayKey', () => {
  it('uses the local date, zero-padded', () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayKey(new Date(2026, 10, 27, 0, 0))).toBe('2026-11-27')
  })
})

describe('pickPlaces', () => {
  it('picks ROUNDS different places from the pool', () => {
    for (const seed of [null, 'a', 'b']) {
      const picks = pickPlaces(seed)
      expect(picks).toHaveLength(ROUNDS)
      expect(new Set(picks).size).toBe(ROUNDS)
      for (const p of picks) expect(allPlaces).toContain(p)
    }
  })

  it('gives everyone the same places for the same seed', () => {
    expect(pickPlaces('2026-11-27')).toEqual(pickPlaces('2026-11-27'))
    expect(pickPlaces('2026-11-27')).not.toEqual(pickPlaces('2026-11-28'))
  })

  // Pins the exact daily challenge. If this changes, everyone's daily
  // changes too: the random number generator, the hash or
  // allPlaces (which places, or their order) was changed. Only update it
  // on purpose.
  it('keeps the daily challenge stable', () => {
    expect(pickPlaces('2026-01-01').map(placeName)).toEqual([
      'Burkina Faso',
      'Botswana',
      'Nepal',
      'Tennessee, USA',
      'Lithuania',
    ])
  })
})

describe('scoreSquare', () => {
  it('turns a score into a share square', () => {
    expect(scoreSquare(5000)).toBe('🟩')
    expect(scoreSquare(4000)).toBe('🟩')
    expect(scoreSquare(3999)).toBe('🟨')
    expect(scoreSquare(2000)).toBe('🟨')
    expect(scoreSquare(1999)).toBe('🟥')
    expect(scoreSquare(0)).toBe('🟥')
  })
})
