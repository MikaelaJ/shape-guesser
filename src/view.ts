// Shared settings for the globe, kept out of Globe.tsx so that file only
// exports components (which keeps hot reloading working while developing).
import { PerspectiveCamera, Raycaster, Sphere, Vector2, Vector3 } from 'three'
import { toLatLon, toVector, type LatLon } from './geo'

export const colors = {
  ocean: '#3b1c31',
  land: '#efe6da',
  border: '#3b1c31',
  accent: '#f0627a',
  answer: '#ffffff',
  glow: '#f0627a',
}

// The camera orbits the globe; the globe itself never rotates, so a point
// clicked on its surface converts straight to latitude/longitude.
// `lat/lon/dist` is where the camera is now, `target*` where it's heading.
// It's a plain mutable object in a ref on purpose: it changes every frame,
// and putting it in React state would re-render the app 60 times a second.
export type View = {
  lat: number
  lon: number
  dist: number
  targetLat: number
  targetLon: number
  targetDist: number
  spin: boolean
}

export const MIN_DIST = 1.6
export const MAX_DIST = 4
export const clampLat = (lat: number) => Math.max(-80, Math.min(80, lat))

export const FOV = 40

// Which point on the globe is under the pointer? The camera is fully
// described by the view, so this is just geometry: a ray from the camera
// through the pointer, intersected with the unit sphere. Returns null when
// the pointer is off the globe.
const raycaster = new Raycaster()
const globe = new Sphere(new Vector3(0, 0, 0), 1)
export function pickOnGlobe(view: View, x: number, y: number, width: number, height: number) {
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 100)
  camera.position.copy(toVector({ lat: view.lat, lon: view.lon }, view.dist))
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  // Pointer position as -1..1 from the centre, with y pointing up
  raycaster.setFromCamera(new Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera)
  const hit = raycaster.ray.intersectSphere(globe, new Vector3())
  return hit ? (toLatLon(hit) as LatLon) : null
}
