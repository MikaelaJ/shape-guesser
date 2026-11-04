import { geoArea, geoCentroid, geoContains, geoDistance, geoInterpolate } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { Vector3 } from 'three'
import { feature, merge, mesh } from 'topojson-client'
import type {
  GeometryCollection,
  MultiPolygon as TopoMultiPolygon,
  Polygon as TopoPolygonObject,
  Topology,
} from 'topojson-specification'
import usAtlas from 'us-atlas/states-10m.json'
import world from 'world-atlas/countries-50m.json'

// Something to guess: a country or a US state
export type Place = Feature<Polygon | MultiPolygon, { name: string }>
type Places = FeatureCollection<Polygon | MultiPolygon, { name: string }>

// Country borders from Natural Earth (public domain), via the world-atlas
// package. 1:50m is detailed enough for recognisable silhouettes.
const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>

// Two changes to Russia's shape in the map data, which includes both:
// - Crimea is shown as part of Ukraine, as recognised internationally (UN
//   General Assembly resolution 68/262). It's merged into Ukraine's
//   outline, so no border is left across the isthmus.
// - Kaliningrad, the exclave on the Baltic, stays on the map as land of
//   its own but isn't part of Russia's outline, so the shape asked about
//   is the main part of the country.
type TopoPolygon = { type: 'Polygon'; arcs: number[][] }
type TopoCountry = {
  type: 'MultiPolygon'
  arcs: number[][][]
  id?: string
  properties: { name: string }
}
const asFeature = (geometry: TopoPolygon | TopoCountry) =>
  feature(topology, geometry as Parameters<typeof feature>[1]) as Place

function redrawRussia(all: Place[]): Place[] {
  const geometries = topology.objects.countries.geometries as unknown as TopoCountry[]
  const russia = geometries.find((g) => g.properties.name === 'Russia')!
  const ukraine = geometries.find((g) => g.properties.name === 'Ukraine')!
  const pieceAt = (lon: number, lat: number) =>
    russia.arcs.findIndex((arcs) =>
      geoContains(asFeature({ type: 'Polygon', arcs }), [lon, lat]),
    )
  const crimea = pieceAt(34.1, 44.95) // Simferopol
  const kaliningrad = pieceAt(20.5, 54.7) // Kaliningrad city

  const mainland = asFeature({
    ...russia,
    arcs: russia.arcs.filter((_, i) => i !== crimea && i !== kaliningrad),
  })
  const ukraineWithCrimea = merge(topology, [
    ukraine as unknown as TopoMultiPolygon,
    { type: 'Polygon', arcs: russia.arcs[crimea] } as TopoPolygonObject,
  ])
  const exclave: Place = {
    ...asFeature({ type: 'Polygon', arcs: russia.arcs[kaliningrad] }),
    properties: { name: 'Kaliningrad' },
  }

  return [
    ...all.map((c) =>
      c.properties.name === 'Russia'
        ? mainland
        : c.properties.name === 'Ukraine'
          ? { ...c, geometry: ukraineWithCrimea }
          : c,
    ),
    exclave,
  ]
}

export const countries = redrawRussia(
  (feature(topology, topology.objects.countries) as Places).features,
)

// Countries big enough to guess from their outline. geoArea is in
// steradians: 0.0008 is roughly 32 000 km2, about the size of Belgium.
// Left out: Antarctica, Kaliningrad (see above), and disputed areas the data draws as separate
// shapes, so the game doesn't take a side. They still appear on the map.
const notAsked = new Set([
  'Antarctica',
  'Fr. S. Antarctic Lands',
  'W. Sahara',
  'Somaliland',
  'N. Cyprus',
  'Kaliningrad',
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


// US states from the US Census Bureau's boundaries (public domain), via the
// us-atlas package. The ids are FIPS codes: the 50 states are 01-56, minus
// 11, the District of Columbia; above 56 are overseas territories.
const us = usAtlas as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>

export const usStates = (feature(us, us.objects.states) as Places).features.filter(
  (state) => Number(state.id) <= 56 && Number(state.id) !== 11,
)

// The lines between neighbouring states, each drawn once. Coastlines and
// the borders with Canada and Mexico are already in the country borders.
export const stateBorders = mesh(us, us.objects.states, (a, b) => a !== b)

// Countries and states are asked together, as shapes: 50 states next to
// about 140 countries, so roughly one round in four is a state.
const states = new Set(usStates)
export const isState = (place: Place) => states.has(place)
export const allPlaces = [...playableCountries, ...usStates]

// States get ", USA" so Georgia the state and Georgia the country can't
// be mixed up
export const placeName = (place: Place) =>
  isState(place)
    ? `${place.properties.name}, USA`
    : (fullNames[place.properties.name] ?? place.properties.name)

// How forgiving the score is (see scoreFor). States are much smaller than
// most countries, so being 500 km off a state should cost more.
export const scoreScaleFor = (place: Place) => (isState(place) ? 500 : 2000)

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

function* outlinePoints(country: Place): Generator<Position> {
  const polygons =
    country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates
  for (const polygon of polygons) for (const ring of polygon) yield* ring
}

// How far a guess is from a country or state, and the closest point on it.
// A guess inside counts as 0 km. Otherwise this measures to the
// nearest border point (vertex), not the centre: a click just over the
// border of a huge country like Russia should score well.
export function distanceToPlace(country: Place, guess: LatLon) {
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

// 5000 inside, then dropping smoothly. `scale` sets how forgiving it is:
// with the countries' 2000 km, 500 km away still gives about 3900 and
// 2000 km about 1800. States are smaller, so they use a smaller scale.
export function scoreFor(km: number, scale = 2000) {
  return Math.round(MAX_SCORE * Math.exp(-km / scale))
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

export function geoCentre(place: Place): LatLon {
  const [lon, lat] = geoCentroid(place)
  return { lat, lon }
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
