import { geoContains } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import {
  allPlaces,
  angleBetween,
  arcPoints,
  countries,
  distanceToPlace,
  formatKm,
  formatLatLon,
  geoCentre,
  MAX_SCORE,
  midpoint,
  placeName,
  playableCountries,
  scoreFor,
  scoreScaleFor,
  toLatLon,
  toVector,
  usStates,
  type LatLon,
} from './geo'

const country = (name: string) => {
  const found = countries.find((c) => c.properties.name === name)
  if (!found) throw new Error(`No country called ${name}`)
  return found
}
const state = (name: string) => {
  const found = usStates.find((s) => s.properties.name === name)
  if (!found) throw new Error(`No state called ${name}`)
  return found
}
const contains = (place: ReturnType<typeof country>, { lat, lon }: LatLon) =>
  geoContains(place, [lon, lat])

const stockholm = { lat: 59.33, lon: 18.07 }
// Stockholm itself is on the coast, which the 1:50m data simplifies: its
// centre lands just outside. Jönköping is safely inland.
const jonkoping = { lat: 57.78, lon: 14.16 }
const copenhagen = { lat: 55.676, lon: 12.568 }
const seattle = { lat: 47.61, lon: -122.33 }
const simferopol = { lat: 44.95, lon: 34.1 }
const kaliningradCity = { lat: 54.7, lon: 20.5 }

describe('toVector and toLatLon', () => {
  // The axes have to match how three.js wraps the texture on the sphere
  it('puts longitude 0 on +X and the north pole on +Y', () => {
    const v = toVector({ lat: 0, lon: 0 })
    expect([v.x, v.y, v.z]).toEqual([1, 0, -0])
    expect(toVector({ lat: 90, lon: 0 }).y).toBeCloseTo(1)
    expect(toVector({ lat: 0, lon: 90 }).z).toBeCloseTo(-1)
  })

  it('scales by the radius', () => {
    expect(toVector(stockholm, 3).length()).toBeCloseTo(3)
  })

  it('converts back to the same latitude and longitude', () => {
    for (const p of [stockholm, seattle, { lat: -33.9, lon: 151.2 }, { lat: 0, lon: -179 }]) {
      const back = toLatLon(toVector(p, 2.5))
      expect(back.lat).toBeCloseTo(p.lat)
      expect(back.lon).toBeCloseTo(p.lon)
    }
  })
})

describe('distanceToPlace', () => {
  it('is 0 km for a guess inside, with the guess as nearest point', () => {
    expect(distanceToPlace(country('Sweden'), jonkoping)).toEqual({ km: 0, nearest: jonkoping })
  })

  it('measures across a short gap: Copenhagen is about 26 km from Sweden', () => {
    const { km } = distanceToPlace(country('Sweden'), copenhagen)
    expect(km).toBeGreaterThan(15)
    expect(km).toBeLessThan(40)
  })

  // The core scoring decision: a guess just outside a big country is close
  it('measures to the nearest border, not the centre', () => {
    const { km } = distanceToPlace(country('Canada'), seattle)
    const toCentre = angleBetween(seattle, geoCentre(country('Canada'))) * 6371
    expect(km).toBeLessThan(200)
    expect(toCentre).toBeGreaterThan(2000)
  })

  it('returns a nearest point that is that far from the guess', () => {
    const { km, nearest } = distanceToPlace(country('Canada'), seattle)
    expect(angleBetween(seattle, nearest) * 6371).toBeCloseTo(km)
  })
})

describe('scoreFor', () => {
  it('gives the maximum at 0 km', () => {
    expect(scoreFor(0)).toBe(MAX_SCORE)
  })

  // The examples in the README
  it('matches the documented falloff for countries', () => {
    expect(scoreFor(500)).toBe(3894)
    expect(scoreFor(2000)).toBe(1839)
  })

  it('matches the documented falloff for states', () => {
    expect(scoreFor(100, 500)).toBe(4094)
  })

  it('never goes up with distance', () => {
    let previous = Infinity
    for (let km = 0; km <= 20000; km += 250) {
      const score = scoreFor(km)
      expect(score).toBeLessThanOrEqual(previous)
      previous = score
    }
    expect(scoreFor(20000)).toBe(0)
  })
})

describe('the pool of places', () => {
  it('has the 50 US states, without DC or the territories', () => {
    expect(usStates).toHaveLength(50)
    const names = usStates.map((s) => s.properties.name)
    expect(names).not.toContain('District of Columbia')
    expect(names).not.toContain('Puerto Rico')
  })

  it('is the playable countries plus the states', () => {
    expect(allPlaces).toHaveLength(playableCountries.length + usStates.length)
  })

  // Deliberate content decisions, see README and AGENTS.md
  it('never asks the places that are left out on purpose', () => {
    const asked = new Set(playableCountries.map((c) => c.properties.name))
    for (const name of [
      'Antarctica',
      'Fr. S. Antarctic Lands',
      'Kaliningrad',
      'W. Sahara',
      'Somaliland',
      'N. Cyprus',
      'Russia',
      'Ukraine',
      'Israel',
      'Palestine',
    ]) {
      expect(asked.has(name), name).toBe(false)
    }
  })

  it('still draws the left-out places on the map', () => {
    for (const name of ['Russia', 'Ukraine', 'Kaliningrad', 'W. Sahara', 'Israel']) {
      expect(() => country(name)).not.toThrow()
    }
  })

  // The limit works out at about 32 400 km2: Moldova (33 100) is in,
  // Guinea-Bissau (32 000) and Belgium (30 600) are out
  it('leaves out countries smaller than the size limit, keeps big ones', () => {
    const asked = new Set(playableCountries.map((c) => c.properties.name))
    expect(asked.has('Luxembourg')).toBe(false)
    expect(asked.has('Belgium')).toBe(false)
    expect(asked.has('Guinea-Bissau')).toBe(false)
    expect(asked.has('Moldova')).toBe(true)
    expect(asked.has('Sweden')).toBe(true)
  })
})

describe('Crimea and Kaliningrad', () => {
  it('draws Crimea as part of Ukraine', () => {
    expect(contains(country('Ukraine'), simferopol)).toBe(true)
    expect(contains(country('Russia'), simferopol)).toBe(false)
  })

  it('keeps Kaliningrad as land of its own, outside Russia', () => {
    expect(contains(country('Kaliningrad'), kaliningradCity)).toBe(true)
    expect(contains(country('Russia'), kaliningradCity)).toBe(false)
  })
})

describe('placeName', () => {
  it('adds ", USA" to states so Georgia and Georgia differ', () => {
    expect(placeName(state('Georgia'))).toBe('Georgia, USA')
    expect(placeName(country('Georgia'))).toBe('Georgia')
  })

  it('writes out the names the map data abbreviates', () => {
    expect(placeName(country('Bosnia and Herz.'))).toBe('Bosnia and Herzegovina')
    expect(placeName(country('United States of America'))).toBe('United States')
  })
})

describe('scoreScaleFor', () => {
  it('is stricter for states than for countries', () => {
    expect(scoreScaleFor(state('Texas'))).toBe(500)
    expect(scoreScaleFor(country('Sweden'))).toBe(2000)
  })
})

describe('arcPoints', () => {
  it('starts and ends just above the two places', () => {
    const points = arcPoints(stockholm, seattle, 32)
    expect(points).toHaveLength(33)
    expect(points[0].distanceTo(toVector(stockholm, 1.003))).toBeCloseTo(0)
    expect(points[32].distanceTo(toVector(seattle, 1.003))).toBeCloseTo(0)
  })

  it('arcs higher for longer distances', () => {
    const peak = (to: LatLon) => Math.max(...arcPoints(stockholm, to).map((p) => p.length()))
    expect(peak(seattle)).toBeGreaterThan(peak(copenhagen))
  })
})

describe('small helpers', () => {
  it('finds the midpoint on the great circle', () => {
    const m = midpoint({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })
    expect(m.lat).toBeCloseTo(0)
    expect(m.lon).toBeCloseTo(45)
  })

  it('measures the angle between two places in radians', () => {
    expect(angleBetween({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })).toBeCloseTo(Math.PI / 2)
  })

  it('formats distances and positions', () => {
    expect(formatKm(1397.4)).toBe('1,397 km')
    expect(formatLatLon({ lat: 59.33, lon: 18.07 })).toBe('59° N, 18° E')
    expect(formatLatLon({ lat: -33.9, lon: -70.6 })).toBe('34° S, 71° W')
  })
})
