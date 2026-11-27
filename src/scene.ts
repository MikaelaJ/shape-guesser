// The parts of the 3D globe, as plain three.js objects. Globe.svelte puts
// them in a scene, keeps them in sync with the game and disposes them.
import { geoEquirectangular, geoGraticule10, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Position } from 'geojson'
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { arcPoints, countries, isState, lakes, stateBorders, toVector, type LatLon, type Place } from './geo'
import { colors } from './view'

// An equirectangular canvas (longitude across, latitude down), which is
// exactly how three.js wraps a texture around a SphereGeometry
function equirectangularCanvas(width: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = width / 2
  const ctx = canvas.getContext('2d')!
  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, width / 4])
  const path = geoPath(projection, ctx)
  const fill = (shape: GeoPermissibleObjects, color: string) => {
    ctx.beginPath()
    path(shape)
    ctx.fillStyle = color
    ctx.fill()
  }
  return { canvas, ctx, path, fill }
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Countries drawn onto a canvas once, for the globe's surface.
// Twice the resolution (8192 px wide) when the graphics card supports it
// and the screen is big, so close zoom stays crisp. Phones keep 4096, which
// is kinder to their memory.
export function globeTexture(maxTextureSize: number) {
  const width = maxTextureSize >= 8192 && window.innerWidth >= 900 ? 8192 : 4096
  const { canvas, ctx, path, fill } = equirectangularCanvas(width)

  ctx.fillStyle = colors.ocean
  ctx.fillRect(0, 0, width, width / 2)

  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  ctx.lineWidth = (2 * width) / 4096
  ctx.stroke()

  // Land only; borders are drawn as 3D lines (see borderLines) so they stay
  // thin and sharp however far you zoom in
  for (const country of countries) fill(country, colors.land)
  // Lakes cut back out of the land
  for (const lake of lakes) fill(lake, colors.ocean)

  const texture = canvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

// The answer filled in the accent colour, on a transparent canvas laid just
// above the globe. States are small, so they get a sharper canvas.
export function highlightTexture(place: Place) {
  const { canvas, fill } = equirectangularCanvas(isState(place) ? 4096 : 2048)
  fill(place, colors.accent)
  return canvasTexture(canvas)
}

// Lines of lon/lat points as line segments just above the surface
function linesGeometry(lines: Position[][]) {
  const positions: number[] = []
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = toVector({ lon: line[i - 1][0], lat: line[i - 1][1] }, 1.0015)
      const b = toVector({ lon: line[i][0], lat: line[i][1] }, 1.0015)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

const outlines = (places: Place[]) =>
  places.flatMap((place) =>
    place.geometry.type === 'Polygon' ? place.geometry.coordinates : place.geometry.coordinates.flat(),
  )

// Every country outline, lake shore and US state line, as 3D lines. Lines
// are drawn by the GPU at a fixed 1 px width, so unlike borders painted
// into the texture they don't get thick and blurry when zoomed in.
export function borderLines() {
  return [
    new THREE.LineSegments(
      linesGeometry([...outlines(countries), ...outlines(lakes)]),
      new THREE.LineBasicMaterial({ color: colors.border }),
    ),
    new THREE.LineSegments(
      linesGeometry(stateBorders.coordinates),
      new THREE.LineBasicMaterial({ color: colors.border, transparent: true, opacity: 0.6 }),
    ),
  ]
}

// A soft glow around the edge of the globe (a classic "fresnel" atmosphere)
export function atmosphere() {
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(colors.glow) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(color, 1.0) * intensity;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material)
  mesh.scale.setScalar(1.12)
  return mesh
}

// The line from the guess to the answer, as a fat line (plain three.js
// lines are always 1 px). It's drawn on by growing a dash from 0 to the
// full length: call draw() with 0..1. Returns null if the two are the same.
export function arcLine(from: LatLon, to: LatLon) {
  const points = arcPoints(from, to)
  const length = points.reduce((sum, p, i) => (i ? sum + p.distanceTo(points[i - 1]) : 0), 0)
  if (length === 0) return null

  const geometry = new LineGeometry()
  geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
  const material = new LineMaterial({ linewidth: 3, dashed: true, gapSize: length * 2 })
  material.color.set(colors.accent)
  const line = new Line2(geometry, material)
  line.computeLineDistances()

  return {
    line,
    material,
    draw(progress: number) {
      material.dashSize = Math.max(progress * length, 0.0001)
    },
  }
}
