import { describe, expect, it } from 'vitest'
import { clampLat, MAX_DIST, MIN_DIST, pickOnGlobe, ZOOM_STEP, zoomBy, type View } from './view'

const viewAt = (lat: number, lon: number, dist: number): View => ({
  lat,
  lon,
  dist,
  targetLat: lat,
  targetLon: lon,
  targetDist: dist,
  spin: true,
})

describe('pickOnGlobe', () => {
  const width = 800
  const height = 600

  // The keyboard crosshair sits in the middle, so this is what Space pins
  it('picks the point the camera looks at in the middle of the screen', () => {
    const hit = pickOnGlobe(viewAt(59.33, 18.07, 3), width / 2, height / 2, width, height)
    expect(hit?.lat).toBeCloseTo(59.33)
    expect(hit?.lon).toBeCloseTo(18.07)
  })

  it('picks further north above the middle and further east to the right', () => {
    const view = viewAt(0, 0, 3)
    const above = pickOnGlobe(view, width / 2, height / 2 - 100, width, height)
    const right = pickOnGlobe(view, width / 2 + 100, height / 2, width, height)
    expect(above!.lat).toBeGreaterThan(0)
    expect(above!.lon).toBeCloseTo(0)
    expect(right!.lon).toBeGreaterThan(0)
    expect(right!.lat).toBeCloseTo(0)
  })

  it('returns null when the pointer is off the globe', () => {
    expect(pickOnGlobe(viewAt(0, 0, MAX_DIST), 0, 0, width, height)).toBeNull()
  })
})

describe('zoomBy', () => {
  it('multiplies the height above the surface', () => {
    const view = viewAt(0, 0, 3)
    zoomBy(view, 1 / ZOOM_STEP)
    expect(view.targetDist).toBeCloseTo(1 + 2 / ZOOM_STEP)
  })

  it('stops at the zoom limits', () => {
    const view = viewAt(0, 0, 3)
    for (let i = 0; i < 50; i++) zoomBy(view, 1 / ZOOM_STEP)
    expect(view.targetDist).toBeCloseTo(MIN_DIST)
    for (let i = 0; i < 50; i++) zoomBy(view, ZOOM_STEP)
    expect(view.targetDist).toBeCloseTo(MAX_DIST)
  })

  it('stops the idle spin', () => {
    const view = viewAt(0, 0, 3)
    zoomBy(view, ZOOM_STEP)
    expect(view.spin).toBe(false)
  })
})

describe('clampLat', () => {
  it('keeps the camera away from the poles', () => {
    expect(clampLat(95)).toBe(80)
    expect(clampLat(-95)).toBe(-80)
    expect(clampLat(45)).toBe(45)
  })
})
