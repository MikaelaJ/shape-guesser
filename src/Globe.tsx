import { Line } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { useMemo, useRef, type ComponentRef, type RefObject } from 'react'
import * as THREE from 'three'
import { arcPoints, countries, toVector, type Country, type LatLon } from './geo'
import { FOV, colors, type View } from './view'

// Countries drawn onto an equirectangular canvas, which three.js wraps
// around the sphere. Drawn once.
function useGlobeTexture() {
  return useMemo(() => {
    const width = 4096
    const height = 2048
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const projection = geoEquirectangular()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, height / 2])
    const path = geoPath(projection, ctx)

    ctx.fillStyle = colors.ocean
    ctx.fillRect(0, 0, width, height)

    ctx.beginPath()
    path(geoGraticule10())
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = colors.land
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1.5
    for (const country of countries) {
      ctx.beginPath()
      path(country)
      ctx.fill()
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [])
}

// The answer country filled in the accent colour, on a transparent canvas
// laid just above the globe
function useHighlightTexture(country: Country | null) {
  return useMemo(() => {
    if (!country) return null
    const width = 2048
    const height = 1024
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const path = geoPath(
      geoEquirectangular()
        .scale(width / (2 * Math.PI))
        .translate([width / 2, height / 2]),
      ctx,
    )
    ctx.beginPath()
    path(country)
    ctx.fillStyle = colors.accent
    ctx.fill()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [country])
}

// Shortest way round: going from 170° to -170° should be 20°, not 340°
function lonDelta(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

function CameraRig({ view, reducedMotion }: { view: RefObject<View>; reducedMotion: boolean }) {
  const { camera } = useThree()
  const light = useRef<THREE.DirectionalLight>(null)
  // Mutating the view every frame is intended (see View in view.ts)
  /* eslint-disable react/immutability */
  useFrame((_, delta) => {
    const v = view.current
    if (v.spin && !reducedMotion) v.targetLon -= delta * 6
    // Ease towards the target; with reduced motion, jump straight there
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 6)
    v.lat += (v.targetLat - v.lat) * k
    v.lon += lonDelta(v.lon, v.targetLon) * k
    v.dist += (v.targetDist - v.dist) * k
    camera.position.copy(toVector({ lat: v.lat, lon: v.lon }, v.dist))
    camera.lookAt(0, 0, 0)
    // Light comes from the camera, so the side you look at is always lit
    light.current?.position.copy(camera.position)
  })
  /* eslint-enable react/immutability */
  return <directionalLight ref={light} intensity={1.6} />
}

// A soft glow around the edge of the globe (a classic "fresnel" atmosphere)
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
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
      }),
    [],
  )
  return (
    <mesh scale={1.12} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  )
}

function Marker({ at, color }: { at: LatLon; color: string }) {
  const position = useMemo(() => toVector(at, 1.004), [at])
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.014, 24, 24]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// The line from the guess to the answer, drawn on over about a second by
// growing a dash from 0 to the full length
function Arc({ from, to, reducedMotion }: { from: LatLon; to: LatLon; reducedMotion: boolean }) {
  const points = useMemo(() => arcPoints(from, to), [from, to])
  const length = useMemo(
    () => points.reduce((sum, p, i) => (i ? sum + p.distanceTo(points[i - 1]) : 0), 0),
    [points],
  )
  const line = useRef<ComponentRef<typeof Line>>(null)
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    elapsed.current += delta
    const t = reducedMotion ? 1 : Math.min(elapsed.current / 1.1, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    if (line.current) {
      line.current.material.dashSize = Math.max(eased * length, 0.0001)
      line.current.material.gapSize = length * 2
    }
  })
  if (length === 0) return null
  return (
    <Line
      ref={line}
      points={points}
      color={colors.accent}
      lineWidth={3}
      dashed
      dashSize={0.0001}
      gapSize={length * 2}
    />
  )
}

type GlobeProps = {
  view: RefObject<View>
  reducedMotion: boolean
  pin: LatLon | null
  reveal: { guess: LatLon; nearest: LatLon; country: Country } | null
}

function Scene({ view, reducedMotion, pin, reveal }: GlobeProps) {
  const texture = useGlobeTexture()
  const highlight = useHighlightTexture(reveal?.country ?? null)

  return (
    <>
      <ambientLight intensity={1.1} />
      <CameraRig view={view} reducedMotion={reducedMotion} />
      {/* Clicks are handled in App with pickOnGlobe, not by three.js events */}
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
      </mesh>
      {highlight && (
        <mesh scale={1.0015}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshBasicMaterial map={highlight} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      <Atmosphere />
      {pin && <Marker at={pin} color={colors.accent} />}
      {reveal && (
        <>
          <Marker at={reveal.nearest} color={colors.answer} />
          <Arc from={reveal.guess} to={reveal.nearest} reducedMotion={reducedMotion} />
        </>
      )}
    </>
  )
}

export function Globe(props: GlobeProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      style={{ touchAction: 'none' }}
    >
      <Scene {...props} />
    </Canvas>
  )
}
