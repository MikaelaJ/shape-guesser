<script lang="ts">
  import * as THREE from 'three'
  import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
  import { toVector, type LatLon, type Place } from './geo'
  import { arcLine, atmosphere, borderLines, globeTexture, highlightTexture } from './scene'
  import { FOV, colors, lonDelta, type View } from './view'

  type Props = {
    // The camera, as a plain object that's changed every frame (see View in
    // view.ts). Not reactive on purpose: it's read in the animation loop.
    view: View
    reducedMotion: boolean
    pin: LatLon | null
    // guess and nearest are null when the time ran out without a pin
    reveal: { guess: LatLon | null; nearest: LatLon | null; country: Place } | null
  }
  let { view, reducedMotion, pin, reveal }: Props = $props()

  // `reveal` is a new object on every render of the game, but its parts
  // only change once a round. $derived only passes on a change when the
  // value itself is a different one, so the effects below don't rerun
  // for nothing.
  const country = $derived(reveal?.country ?? null)
  const guess = $derived(reveal?.guess ?? null)
  const nearest = $derived(reveal?.nearest ?? null)

  let host = $state<HTMLDivElement>()

  // The scene, built once. Plain three.js objects, never in $state (see
  // AGENTS.md §1). Disposed when the globe goes away.
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  // Light comes from the camera, so the side you look at is always lit
  const light = new THREE.DirectionalLight(0xffffff, 1.6)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), light)

  const sphere = new THREE.SphereGeometry(1, 128, 128)
  // polygonOffset nudges the surface back in the depth buffer, so the
  // border lines just above it never flicker ("z-fighting")
  const surface = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const borders = borderLines()
  const glow = atmosphere()
  scene.add(new THREE.Mesh(sphere, surface), ...borders, glow)

  const markerGeometry = new THREE.SphereGeometry(0.014, 24, 24)

  // Things that run every frame, like useFrame in react-three-fiber. The
  // effects below add to it and remove themselves when they're cleaned up.
  const onFrame = new Set<(delta: number) => void>()
  // Fat lines need the canvas size to know how wide a pixel is
  const size = new THREE.Vector2(1, 1)
  const fatLines = new Set<LineMaterial>()

  // Clicks are handled by the game with pickOnGlobe, not by three.js
  // events, so the canvas only draws.
  $effect(() => {
    // This effect must only run once: it reads `host` (set once by
    // bind:this) and nothing else reactive. Props are read inside the
    // animation loop, which isn't tracked.
    const element = host!
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    // react-three-fiber turned this on by default; kept so colours match
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1), 2))
    element.appendChild(renderer.domElement)

    const texture = globeTexture(renderer.capabilities.maxTextureSize)
    surface.map = texture
    surface.needsUpdate = true

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = element
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      size.set(width, height)
      for (const material of fatLines) material.resolution.copy(size)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)

    const timer = new THREE.Timer()
    renderer.setAnimationLoop((time) => {
      timer.update(time)
      const delta = timer.getDelta()
      const v = view
      if (v.spin && !reducedMotion) v.targetLon -= delta * 6
      // Ease towards the target; with reduced motion, jump straight there
      const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 6)
      v.lat += (v.targetLat - v.lat) * k
      v.lon += lonDelta(v.lon, v.targetLon) * k
      v.dist += (v.targetDist - v.dist) * k
      camera.position.copy(toVector({ lat: v.lat, lon: v.lon }, v.dist))
      camera.lookAt(0, 0, 0)
      light.position.copy(camera.position)

      for (const callback of onFrame) callback(delta)
      renderer.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      texture.dispose()
      sphere.dispose()
      surface.dispose()
      for (const line of borders) {
        line.geometry.dispose()
        line.material.dispose()
      }
      glow.geometry.dispose()
      glow.material.dispose()
      markerGeometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  })

  // Adds a pin, and removes it again when the effect that added it reruns
  // or the globe goes away. Pins shrink as you zoom in, so they stay about
  // the same size on screen instead of covering a small country.
  function addMarker(at: LatLon, color: string) {
    const material = new THREE.MeshBasicMaterial({ color })
    const marker = new THREE.Mesh(markerGeometry, material)
    marker.position.copy(toVector(at, 1.004))
    // Only set in the frame loop: reading `view` here would make it a
    // dependency of the effect that called addMarker. The loop runs before
    // each render, so the pin never shows at the wrong size.
    const scale = () => marker.scale.setScalar(Math.min(1, Math.max(0.12, (view.dist - 1) / 2)))
    scene.add(marker)
    onFrame.add(scale)
    return () => {
      onFrame.delete(scale)
      scene.remove(marker)
      material.dispose()
    }
  }

  // The pin you dropped
  $effect(() => {
    if (pin) return addMarker(pin, colors.accent)
  })

  // The answer: the place lit up, a pin on its nearest point...
  $effect(() => {
    if (!country) return
    const texture = highlightTexture(country)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(sphere, material)
    mesh.scale.setScalar(1.0015)
    scene.add(mesh)
    return () => {
      scene.remove(mesh)
      material.dispose()
      texture.dispose()
    }
  })

  $effect(() => {
    if (nearest) return addMarker(nearest, colors.answer)
  })

  // ...and the arc from the guess to it, drawn on over about a second
  $effect(() => {
    if (!guess || !nearest) return
    const arc = arcLine(guess, nearest)
    if (!arc) return
    arc.material.resolution.copy(size)
    fatLines.add(arc.material)
    scene.add(arc.line)

    let elapsed = 0
    const draw = (delta: number) => {
      elapsed += delta
      const t = reducedMotion ? 1 : Math.min(elapsed / 1.1, 1)
      arc.draw(1 - Math.pow(1 - t, 3))
    }
    // Not called here, only in the frame loop, for the same reason as the
    // pin's scale: it reads `reducedMotion`
    onFrame.add(draw)
    return () => {
      onFrame.delete(draw)
      fatLines.delete(arc.material)
      scene.remove(arc.line)
      arc.line.geometry.dispose()
      arc.material.dispose()
    }
  })
</script>

<div class="scene" bind:this={host}></div>

<style>
  .scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }
  .scene :global(canvas) {
    display: block;
  }
</style>
