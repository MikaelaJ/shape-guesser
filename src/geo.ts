import { geoArea, geoContains, geoDistance, geoInterpolate } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { Vector3 } from 'three'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-50m.json'

// Country borders from Natural Earth (public domain), via the world-atlas
// package. 1:50m is detailed enough for recognisable silhouettes.
export type Country = Feature<Polygon | MultiPolygon, { name: string }>

const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>

export const countries = (
  feature(topology, topology.objects.countries) as FeatureCollection<
    Polygon | MultiPolygon,
    { name: string }
  >
).features

// Countries big enough to guess from their outline. geoArea is in
// steradians: 0.0008 is roughly 32 000 km2, about the size of Belgium.
// Left out: Antarctica, and disputed areas the data draws as separate
// shapes, so the game doesn't take a side. They still appear on the map.
const notAsked = new Set([
  'Antarctica',
  'Fr. S. Antarctic Lands',
  'W. Sahara',
  'Somaliland',
  'N. Cyprus',
])
export const playableCountries = countries.filter(
  (c) => !notAsked.has(c.properties.name) && geoArea(c) > 0.0008,
)

// The map data abbreviates some names to fit on printed maps
const fullNames: Record<string, string> = {
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Falkland Is.': 'Falkland Islands',
  'Faeroe Is.': 'Faroe Islands',
  'Fr. Polynesia': 'French Polynesia',
  'Marshall Is.': 'Marshall Islands',
  'Solomon Is.': 'Solomon Islands',
  'S. Sudan': 'South Sudan',
  Macedonia: 'North Macedonia',
  eSwatini: 'Eswatini',
  'United States of America': 'United States',
}

export const countryName = (country: Country) =>
  fullNames[country.properties.name] ?? country.properties.name

export type LatLon = { lat: number; lon: number }

const EARTH_RADIUS_KM = 6371
const toRad = Math.PI / 180

// Latitude/longitude <-> a point on the globe. The axes match how three.js
// wraps an equirectangular texture around a SphereGeometry: longitude 0 is
// +X, the north pole is +Y.
export function toVector({ lat, lon }: LatLon, radius = 1) {
  const la = lat * toRad
  const lo = lon * toRad
  return new Vector3(
    radius * Math.cos(la) * Math.cos(lo),
    radius * Math.sin(la),
    -radius * Math.cos(la) * Math.sin(lo),
  )
}

export function toLatLon(v: Vector3): LatLon {
  const n = v.clone().normalize()
  return { lat: Math.asin(n.y) / toRad, lon: Math.atan2(-n.z, n.x) / toRad }
}

const asPosition = (p: LatLon): [number, number] => [p.lon, p.lat]

function* outlinePoints(country: Country): Generator<Position> {
  const polygons =
    country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates
  for (const polygon of polygons) for (const ring of polygon) yield* ring
}

// How far a guess is from a country, and the closest point on it. A guess
// inside the country counts as 0 km. Otherwise this measures to the
// nearest border point (vertex), not the centre: a click just over the
// border of a huge country like Russia should score well.
export function distanceToCountry(country: Country, guess: LatLon) {
  if (geoContains(country, asPosition(guess))) return { km: 0, nearest: guess }

  let best = Infinity
  let nearest: Position = asPosition(guess)
  for (const point of outlinePoints(country)) {
    const d = geoDistance(asPosition(guess), point as [number, number])
    if (d < best) {
      best = d
      nearest = point
    }
  }
  return { km: best * EARTH_RADIUS_KM, nearest: { lon: nearest[0], lat: nearest[1] } }
}

export const MAX_SCORE = 5000

// 5000 inside the country, then dropping smoothly: 500 km away still gives
// about 3900, 2000 km about 1800.
export function scoreFor(km: number) {
  return Math.round(MAX_SCORE * Math.exp(-km / 2000))
}

// Points along the great circle between two places, lifted off the surface
// into an arc. Longer distances arc higher.
export function arcPoints(from: LatLon, to: LatLon, segments = 64) {
  const interpolate = geoInterpolate(asPosition(from), asPosition(to))
  const angle = geoDistance(asPosition(from), asPosition(to))
  const height = 0.02 + 0.25 * Math.min(angle / Math.PI, 1)
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments
    const [lon, lat] = interpolate(t)
    return toVector({ lat, lon }, 1.003 + height * Math.sin(Math.PI * t))
  })
}

export function midpoint(a: LatLon, b: LatLon): LatLon {
  const [lon, lat] = geoInterpolate(asPosition(a), asPosition(b))(0.5)
  return { lat, lon }
}

export function angleBetween(a: LatLon, b: LatLon) {
  return geoDistance(asPosition(a), asPosition(b))
}

export function formatKm(km: number) {
  return `${Math.round(km).toLocaleString('en-GB')} km`
}

export function formatLatLon({ lat, lon }: LatLon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(0)}° ${ns}, ${Math.abs(lon).toFixed(0)}° ${ew}`
}
