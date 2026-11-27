<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity'
  import { cluesFor } from './facts'
  import { CLUE_TIMES, ROUNDS, ROUND_SECONDS, pickPlaces, speedFactor, todayKey } from './game'
  import {
    MAX_SCORE,
    angleBetween,
    distanceToPlace,
    formatKm,
    formatLatLon,
    geoCentre,
    isState,
    midpoint,
    placeName,
    scoreFor,
    scoreScaleFor,
    type LatLon,
    type Place,
  } from './geo'
  import Globe from './Globe.svelte'
  import { music } from './music'
  import { PORTFOLIO_URL, percent, points, type Result } from './result'
  import RevealPanel from './RevealPanel.svelte'
  import { StoredBoolean } from './settings.svelte'
  import Silhouette from './Silhouette.svelte'
  import { sounds } from './sound'
  import SummaryPanel from './SummaryPanel.svelte'
  import {
    MAX_DIST,
    MIN_DIST,
    ZOOM_STEP,
    clampLat,
    pickOnGlobe,
    zoomBy,
    type View,
  } from './view'
  import ZoomButtons from './ZoomButtons.svelte'

  type Phase = 'intro' | 'guessing' | 'reveal' | 'summary'

  const reducedMotion = new MediaQuery('prefers-reduced-motion: reduce')
  const soundOn = new StoredBoolean('shape-guesser:sound', true)
  const timerOn = new StoredBoolean('shape-guesser:timer', true)
  const musicOn = new StoredBoolean('shape-guesser:music', true)
  // Music never starts by itself on page load, only once the player has
  // pressed Play or the Music button
  let musicStarted = $state(false)
  $effect(() => {
    const update = () =>
      musicOn.current && musicStarted && !document.hidden
        ? music.play()
        : music.pause(document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  })

  // The camera. A plain object, not $state: it changes every frame, and
  // the globe reads it in its animation loop (see View in view.ts).
  const view: View = {
    lat: 20,
    lon: 10,
    dist: 3,
    targetLat: 20,
    targetLon: 10,
    targetDist: 3,
    spin: true,
  }

  let phase = $state<Phase>('intro')
  let daily = $state(true)
  // $state.raw: these hold GeoJSON places, which must not be deep proxies.
  // They're replaced, never changed in place.
  let rounds = $state.raw<Place[]>([])
  let results = $state.raw<Result[]>([])
  let pin = $state.raw<LatLon | null>(null)
  let round = $state(0)
  let announcement = $state('')
  // Seconds into the round
  let elapsed = $state(0)

  let globe = $state<HTMLDivElement>()

  const total = $derived(results.reduce((sum, r) => sum + r.score, 0))
  const current = $derived(rounds[round] as Place | undefined)
  const lastResult = $derived(results.at(-1))
  const clues = $derived(current ? cluesFor(current) : [])
  const cluesShown = $derived(CLUE_TIMES.filter((at) => elapsed >= at).length)
  const reveal = $derived(
    phase === 'reveal' && lastResult
      ? { guess: lastResult.guess, nearest: lastResult.nearest, country: lastResult.country }
      : null,
  )

  function play(sound: () => void) {
    if (!soundOn.current) return
    try {
      sound()
    } catch {
      // No audio available - the game works fine without it
    }
  }

  // Screen reader announcements. The zero-width space makes a repeated
  // message count as new, so it's read out again.
  function announce(message: string) {
    announcement = announcement === message ? `${message}​` : message
  }

  // Focus moves to where the player acts next: the globe at the start of
  // each round. (The reveal and summary panels focus their own button and
  // heading when they appear.)
  $effect(() => {
    void round // rerun for every new round, not only when the phase changes
    if (phase === 'guessing') globe?.focus()
  })

  const roundPrompt = (n: number) =>
    `Round ${n} of ${ROUNDS}. Where is this shape? It's a country or a US state. Find it on the globe.`

  function start(isDaily: boolean) {
    musicStarted = true
    daily = isDaily
    rounds = pickPlaces(isDaily ? todayKey() : null)
    round = 0
    results = []
    pin = null
    elapsed = 0
    phase = 'guessing'
    view.spin = false
    view.targetDist = 3
    announce(roundPrompt(1))
  }

  function placePin(point: LatLon) {
    pin = point
    play(sounds.pin)
    announce(`Pin placed at ${formatLatLon(point)}. Press Enter or the Guess button to guess.`)
  }

  function guess(point: LatLon | null = pin) {
    if (!point || !current) return
    const place = current
    const seconds = elapsed
    const { km, nearest } = distanceToPlace(place, point)
    const score = Math.round(scoreFor(km, scoreScaleFor(place)) * speedFactor(seconds))
    pin = point
    results = [...results, { country: place, guess: point, nearest, km, seconds, score }]
    phase = 'reveal'

    // Fly the camera out to see both the guess and the answer
    const centre = midpoint(point, nearest)
    view.targetLat = clampLat(centre.lat)
    view.targetLon = centre.lon
    const base = isState(place) ? 1.6 : 2.2
    view.targetDist = Math.min(
      Math.max(base + angleBetween(point, nearest) * 1.2, MIN_DIST),
      MAX_DIST,
    )

    play(() => sounds.reveal(score))
    const name = placeName(place)
    announce(
      km === 0
        ? `Spot on, that's inside ${name}! ${Math.round(seconds)} seconds. ${score} points.`
        : `It was ${name}. You were ${formatKm(km)} away, after ${Math.round(seconds)} seconds. ${score} points.`,
    )
  }

  // Out of time: a dropped pin counts as the guess, otherwise no points
  function timeUp() {
    if (!current) return
    if (pin) {
      guess(pin)
      return
    }
    const place = current
    results = [
      ...results,
      { country: place, guess: null, nearest: null, km: null, seconds: ROUND_SECONDS, score: 0 },
    ]
    phase = 'reveal'
    const centre = geoCentre(place)
    view.targetLat = clampLat(centre.lat)
    view.targetLon = centre.lon
    view.targetDist = isState(place) ? 1.6 : 2.2
    play(() => sounds.reveal(0))
    announce(`Time's up! It was ${placeName(place)}. 0 points.`)
  }

  // Moves the round's clock forward, by the timer or by asking for a clue,
  // and gives out clues, the 10 second warning and the time-up as it goes
  function advanceClock(to: number) {
    if (phase !== 'guessing' || !current) return
    const from = elapsed
    const now = Math.min(to, ROUND_SECONDS)
    elapsed = now
    CLUE_TIMES.forEach((at, i) => {
      const clue = clues[i]
      if (clue && from < at && now >= at) {
        play(sounds.pin)
        announce(`Clue. ${clue.label}: ${clue.value}.`)
      }
    })
    if (!timerOn.current) return
    const warnAt = ROUND_SECONDS - 10
    if (from < warnAt && now >= warnAt) announce('10 seconds left.')
    if (now >= ROUND_SECONDS) timeUp()
  }

  function takeClue() {
    const nextAt = CLUE_TIMES.find((at) => at > elapsed)
    if (nextAt !== undefined) advanceClock(nextAt)
  }

  // The timer ticks only while guessing with the timer on, and not while
  // the tab is hidden. A long gap between ticks (a sleeping laptop) counts
  // as a quarter of a second, so nobody loses a round to it.
  $effect(() => {
    if (phase !== 'guessing' || !timerOn.current) return
    void round // a fresh interval for every round
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(now - last, 250) / 1000
      last = now
      if (!document.hidden) advanceClock(elapsed + delta)
    }, 100)
    return () => clearInterval(timer)
  })

  function next() {
    if (round + 1 >= ROUNDS) {
      phase = 'summary'
      view.spin = true
      view.targetDist = 3
      play(sounds.finish)
      announce(`Game over. You scored ${total} out of ${ROUNDS * MAX_SCORE} points.`)
      return
    }
    round += 1
    pin = null
    elapsed = 0
    phase = 'guessing'
    announce(roundPrompt(round + 1))
  }

  const normaliseLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

  // Keyboard play: the crosshair in the middle of the screen is the aim.
  // Arrow keys spin the globe under it, Space drops a pin, Enter guesses.
  function onGlobeKeyDown(event: KeyboardEvent) {
    if (phase !== 'guessing') return
    const v = view
    const step = (event.shiftKey ? 15 : 4) * ((v.targetDist - 1) / 2)
    const centre = () => ({ lat: v.targetLat, lon: normaliseLon(v.targetLon) })
    switch (event.key) {
      case 'ArrowLeft':
        v.targetLon -= step
        break
      case 'ArrowRight':
        v.targetLon += step
        break
      case 'ArrowUp':
        v.targetLat = clampLat(v.targetLat + step)
        break
      case 'ArrowDown':
        v.targetLat = clampLat(v.targetLat - step)
        break
      case '+':
      case '=':
        zoomBy(v, 1 / ZOOM_STEP)
        break
      case '-':
        zoomBy(v, ZOOM_STEP)
        break
      case 'c':
      case 'C':
        takeClue()
        break
      case ' ':
        placePin(centre())
        break
      case 'Enter':
        guess(pin ?? centre())
        break
      default:
        return
    }
    event.preventDefault()
  }

  // Pointer gestures on the globe:
  // - one pointer: drag to spin; a press that barely moves is a click,
  //   which drops a pin where the pointer is
  // - two pointers (touch): pinch to zoom
  // Moves and releases are listened for on the window, so a drag keeps
  // working when the pointer leaves the globe. Plain object, not $state:
  // nothing on screen depends on it.
  const gesture = {
    pointers: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    pinched: false,
    pinchSpread: 0,
  }

  // Distance between the first two touch points, for pinch zoom
  function spread() {
    const [a, b] = [...gesture.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  function onGlobePointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const g = gesture
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (g.pointers.size === 1) {
      g.startX = event.clientX
      g.startY = event.clientY
      g.pinched = false
    } else {
      g.pinched = true
      g.pinchSpread = spread()
    }
    view.spin = false
  }

  function onPointerMove(event: PointerEvent) {
    const g = gesture
    const p = g.pointers.get(event.pointerId)
    if (!p) return
    const dx = event.clientX - p.x
    const dy = event.clientY - p.y
    p.x = event.clientX
    p.y = event.clientY
    if (g.pointers.size >= 2) {
      const now = spread()
      if (g.pinchSpread > 0 && now > 0) zoomBy(view, g.pinchSpread / now)
      g.pinchSpread = now
      return
    }
    // Spin speed follows the zoom, so the map moves with the pointer
    const k = 0.2 * ((view.dist - 0.8) / 2.2)
    view.targetLon -= dx * k
    view.targetLat = clampLat(view.targetLat + dy * k)
  }

  function onPointerUp(event: PointerEvent) {
    const g = gesture
    if (!g.pointers.delete(event.pointerId)) return
    if (g.pointers.size > 0) {
      g.pinchSpread = 0
      return
    }
    if (event.type === 'pointercancel' || g.pinched) return
    const moved = Math.hypot(event.clientX - g.startX, event.clientY - g.startY)
    if (moved > 6 || phase !== 'guessing' || !globe) return
    const rect = globe.getBoundingClientRect()
    const point = pickOnGlobe(
      view,
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    )
    if (point) placePin(point)
  }

  function onGlobeWheel(event: WheelEvent) {
    // Trackpads send many small deltas, mouse wheels a few big ones;
    // an exponential keeps both smooth
    zoomBy(view, Math.exp(event.deltaY * 0.0015))
  }
</script>

<svelte:window
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
/>

<div class="app">
  <header class="topbar">
    <p class="brand">
      Outlinr
      <span class="byline">
        by <a href={PORTFOLIO_URL}>Mikaela Johansson</a>
      </span>
    </p>
    <div class="settings">
      <!-- A time limit you can't turn off fails WCAG 2.2.1, and not
           everyone can find a place in 60 seconds -->
      <button
        type="button"
        class="chip-button"
        aria-pressed={timerOn.current}
        onclick={() => (timerOn.current = !timerOn.current)}
      >
        Timer {timerOn.current ? 'on' : 'off'}
      </button>
      <!-- Music that plays for more than 3 seconds needs a way to stop
           it (WCAG 1.4.2), separate from the sound effects -->
      <button
        type="button"
        class="chip-button"
        aria-pressed={musicOn.current}
        onclick={() => {
          musicOn.current = !musicOn.current
          musicStarted = true
        }}
      >
        Music {musicOn.current ? 'on' : 'off'}
      </button>
      <button
        type="button"
        class="chip-button"
        aria-pressed={soundOn.current}
        onclick={() => (soundOn.current = !soundOn.current)}
      >
        Sound {soundOn.current ? 'on' : 'off'}
      </button>
    </div>
  </header>

  <!-- role="application" tells screen readers to pass the arrow keys
       through to the game (keyboard play), instead of using them to read
       the page. Svelte's check doesn't count it as interactive, but here it
       is: it takes focus, keys and pointer gestures. See AGENTS.md §8. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={globe}
    class="globe"
    tabindex={phase === 'guessing' ? 0 : -1}
    role="application"
    aria-label="Globe"
    aria-describedby="globe-help"
    onkeydown={onGlobeKeyDown}
    onpointerdown={onGlobePointerDown}
    onwheel={onGlobeWheel}
  >
    <Globe
      {view}
      reducedMotion={reducedMotion.current}
      pin={phase === 'guessing' || phase === 'reveal' ? pin : null}
      {reveal}
    />
    {#if phase === 'guessing'}
      <div class="crosshair" aria-hidden="true"></div>
    {/if}
  </div>

  <ZoomButtons {view} />
  <p id="globe-help" class="sr-only">
    Arrow keys spin the globe under the crosshair in the middle, hold Shift for bigger steps. Plus
    and minus zoom. Space drops a pin, Enter guesses, C gives a clue.
  </p>

  {#if phase === 'intro'}
    <section class="panel intro" aria-labelledby="intro-title">
      <h1 id="intro-title">Outlinr</h1>
      <p>
        You get a shape: a country or a US state. Find it on the globe and drop a pin. The closer
        and faster you are, the more points: {ROUNDS} rounds, up to
        {points(MAX_SCORE)} points each. Stuck? Clues appear as time goes by.
      </p>
      <div class="actions">
        <button type="button" class="primary" onclick={() => start(true)}>
          Play today’s challenge
        </button>
        <button type="button" onclick={() => start(false)}>Random shapes</button>
      </div>
      <details class="how">
        <summary>How to play</summary>
        <ul>
          <li>
            <strong>Mouse or touch:</strong> drag to spin, scroll, pinch or use the + and − buttons
            to zoom, click to drop a pin, then press Guess.
          </li>
          <li>
            <strong>Keyboard:</strong> arrow keys spin the globe under the crosshair, + and − zoom,
            Space drops a pin, Enter guesses, C gives a clue.
          </li>
          <li>
            <strong>Time and clues:</strong> each round has {ROUND_SECONDS} seconds. The population
            comes after {CLUE_TIMES[0]} seconds, the part of the world after
            {CLUE_TIMES[1]} and the first letter after {CLUE_TIMES[2]}. Getting a clue early skips
            the clock ahead to it.
          </li>
          <li>
            <strong>Speed bonus:</strong> guess straight away and you keep all your points; at the
            end of the time, half. Turn the timer off at the top to play without a time limit;
            clues then only come when you ask, and still cost the same.
          </li>
          <li>
            Inside the shape is a perfect score. Outside, distance is measured to its nearest
            border, not its centre.
          </li>
        </ul>
      </details>
      <p class="sources">
        Population from <a href="https://www.wikidata.org">Wikidata</a>. Borders from
        <a href="https://www.naturalearthdata.com">Natural Earth</a> and the
        <a href="https://www.census.gov">US Census Bureau</a>. All public domain. Music made with
        Google Gemini.
      </p>
    </section>
  {/if}

  {#if phase === 'guessing' && current}
    <section class="panel round" aria-label="Round {round + 1} of {ROUNDS}">
      <p class="eyebrow">
        Round {round + 1} / {ROUNDS} · {points(total)} points
      </p>
      <Silhouette country={current} />
      <p class="prompt">Where is this?</p>
      {#if timerOn.current}
        <div class="clock" aria-hidden="true">
          <div class="clock-fill" style:width="{(1 - elapsed / ROUND_SECONDS) * 100}%"></div>
        </div>
      {/if}
      <p class="speed">
        {#if timerOn.current}{Math.ceil(ROUND_SECONDS - elapsed)} s left ·{' '}{/if}Speed bonus
        {percent(speedFactor(elapsed))}
      </p>
      {#if cluesShown > 0}
        <dl class="clues">
          {#each clues.slice(0, cluesShown) as clue (clue.label)}
            <div>
              <dt>{clue.label}</dt>
              <dd>{clue.value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
      {#if cluesShown < clues.length}
        <button type="button" class="chip-button clue-button" onclick={takeClue}>
          Get a clue
        </button>
      {/if}
    </section>
    <div class="guess-bar">
      <button type="button" class="primary" disabled={!pin} onclick={() => guess()}>
        {pin ? 'Guess' : 'Drop a pin on the globe'}
      </button>
    </div>
  {/if}

  {#if phase === 'reveal' && lastResult}
    <RevealPanel
      result={lastResult}
      isLast={round + 1 >= ROUNDS}
      reducedMotion={reducedMotion.current}
      onNext={next}
    />
  {/if}

  {#if phase === 'summary'}
    <SummaryPanel
      {results}
      {daily}
      reducedMotion={reducedMotion.current}
      onPlay={start}
      {announce}
    />
  {/if}

  <p class="sr-only" aria-live="polite">{announcement}</p>
</div>
