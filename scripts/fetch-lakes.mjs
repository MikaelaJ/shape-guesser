// Fetches the big lakes from Natural Earth (public domain) and saves them to
// src/data/lakes.json. The country shapes include lakes as land, so without
// these the Great Lakes, Victoria, Baikal or Vänern would be missing, and
// Michigan, say, would have no shoreline at all.
//
// Run it with `pnpm data:lakes`. The result is committed, so the game
// doesn't depend on the download.
import { geoArea } from 'd3-geo'
import { writeFileSync } from 'node:fs'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson'
// Smaller lakes don't show at the game's zoom levels
const MIN_KM2 = 1500
const EARTH_RADIUS_KM = 6371

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`Natural Earth answered ${response.status}`)
const data = await response.json()

// Three decimals is about 100 m, plenty at the closest zoom
const round = (coordinates) =>
  typeof coordinates[0] === 'number'
    ? coordinates.map((n) => Math.round(n * 1000) / 1000)
    : coordinates.map(round)

const seen = new Set()
const lakes = data.features
  .filter((lake) => geoArea(lake) * EARTH_RADIUS_KM ** 2 >= MIN_KM2)
  // The data has a few lakes twice (at two scale ranks)
  .filter((lake) => {
    const key = `${lake.properties.name}:${Math.round(geoArea(lake) * 1e6)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  .map((lake) => ({
    type: 'Feature',
    properties: { name: lake.properties.name },
    geometry: { type: lake.geometry.type, coordinates: round(lake.geometry.coordinates) },
  }))

writeFileSync(
  new URL('../src/data/lakes.json', import.meta.url),
  `${JSON.stringify({
    source: 'Natural Earth 1:50m lakes, https://www.naturalearthdata.com (public domain)',
    type: 'FeatureCollection',
    features: lakes,
  })}\n`,
)
console.log(`Saved ${lakes.length} lakes over ${MIN_KM2} km².`)
