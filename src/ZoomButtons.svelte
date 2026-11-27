<script lang="ts">
  import { MAX_DIST, MIN_DIST, ZOOM_STEP, zoomBy, type View } from './view'

  // On-screen zoom buttons, for anyone without a scroll wheel or pinch.
  // Disabled at the zoom limits, which is checked a few times a second
  // because the distance lives in the per-frame view, not in $state.
  let { view }: { view: View } = $props()

  // Only the starting value is read here on purpose: the poll below keeps
  // it up to date
  // svelte-ignore state_referenced_locally
  let dist = $state(view.targetDist)
  $effect(() => {
    const timer = setInterval(() => (dist = view.targetDist), 200)
    return () => clearInterval(timer)
  })

  function zoom(factor: number) {
    zoomBy(view, factor)
    dist = view.targetDist
  }
</script>

<div class="zoom" role="group" aria-label="Zoom">
  <button
    type="button"
    aria-label="Zoom in"
    disabled={dist <= MIN_DIST + 0.001}
    onclick={() => zoom(1 / ZOOM_STEP)}
  >
    <span aria-hidden="true">+</span>
  </button>
  <button
    type="button"
    aria-label="Zoom out"
    disabled={dist >= MAX_DIST - 0.001}
    onclick={() => zoom(ZOOM_STEP)}
  >
    <span aria-hidden="true">−</span>
  </button>
</div>
