import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from 'react'
import { cluesFor } from './facts'
import {
  CLUE_TIMES,
  ROUNDS,
  ROUND_SECONDS,
  pickPlaces,
  scoreSquare,
  speedFactor,
  todayKey,
} from './game'
import {
  MAX_SCORE,
  angleBetween,
  distanceToPlace,
  geoCentre,
  isState,
  scoreScaleFor,
  formatKm,
  formatLatLon,
  midpoint,
  scoreFor,
  placeName,
  type Place,
  type LatLon,
} from './geo'
import { Globe } from './Globe'
import { useCountUp, useReducedMotion, useStoredBoolean } from './hooks'
import { Silhouette } from './Silhouette'
import { sounds } from './sound'
import {
  MAX_DIST,
  MIN_DIST,
  ZOOM_STEP,
  clampLat,
  pickOnGlobe,
  zoomBy,
  type View,
} from './view'

type Phase = 'intro' | 'guessing' | 'reveal' | 'summary'
// guess, nearest and km are null when the time ran out without a pin
type Result = {
  country: Place
  guess: LatLon | null
  nearest: LatLon | null
  km: number | null
  seconds: number
  score: number
}

const PORTFOLIO_URL = 'https://mikaelajohansson.com/'
const GAME_URL = 'https://mikaelajohansson.com/shape-guesser/'

const normaliseLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

// Distance between the first two touch points, for pinch zoom
function spread(pointers: Map<number, { x: number; y: number }>) {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
const points = (n: number) => n.toLocaleString('en-GB')
const percent = (factor: number) => `${Math.round(factor * 100)} %`

export default function App() {
  const reducedMotion = useReducedMotion()
  const [soundOn, setSoundOn] = useStoredBoolean('shape-guesser:sound', true)
  const [timerOn, setTimerOn] = useStoredBoolean('shape-guesser:timer', true)
  const view = useRef<View>({
    lat: 20,
    lon: 10,
    dist: 3,
    targetLat: 20,
    targetLon: 10,
    targetDist: 3,
    spin: true,
  })

  const [phase, setPhase] = useState<Phase>('intro')
  const [daily, setDaily] = useState(true)
  const [rounds, setRounds] = useState<Place[]>([])
  const [round, setRound] = useState(0)
  const [pin, setPin] = useState<LatLon | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [announcement, setAnnouncement] = useState('')
  // Seconds into the round. The ref is the source of truth for the game
  // logic; the state is for showing it.
  const clock = useRef(0)
  const [elapsed, setElapsed] = useState(0)

  // The pointer-up handler outlives the render it was created in, so it
  // reads the phase from a ref rather than a stale closure
  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const globeRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLHeadingElement>(null)

  const play = (sound: () => void) => {
    if (!soundOn) return
    try {
      sound()
    } catch {
      // No audio available - the game works fine without it
    }
  }

  // Screen reader announcements. The zero-width space makes a repeated
  // message count as new, so it's read out again.
  const announce = (message: string) =>
    setAnnouncement((previous) => (previous === message ? `${message}​` : message))

  const total = results.reduce((sum, r) => sum + r.score, 0)
  const current = rounds[round]
  const lastResult = results[results.length - 1]
  const clues = current ? cluesFor(current) : []
  const cluesShown = CLUE_TIMES.filter((at) => elapsed >= at).length

  // Move keyboard focus to wherever the player needs to act next
  useEffect(() => {
    if (phase === 'guessing') globeRef.current?.focus()
    if (phase === 'reveal') nextRef.current?.focus()
    if (phase === 'summary') summaryRef.current?.focus()
  }, [phase, round])

  const roundPrompt = (n: number) =>
    `Round ${n} of ${ROUNDS}. Where is this shape? It's a country or a US state. Find it on the globe.`

  function start(isDaily: boolean) {
    setDaily(isDaily)
    setRounds(pickPlaces(isDaily ? todayKey() : null))
    setRound(0)
    setResults([])
    setPin(null)
    resetClock()
    setPhase('guessing')
    view.current.spin = false
    view.current.targetDist = 3
    announce(roundPrompt(1))
  }

  function placePin(point: LatLon) {
    setPin(point)
    play(sounds.pin)
    announce(`Pin placed at ${formatLatLon(point)}. Press Enter or the Guess button to guess.`)
  }

  function guess(point: LatLon | null = pin) {
    if (!point || !current) return
    const seconds = clock.current
    const { km, nearest } = distanceToPlace(current, point)
    const score = Math.round(scoreFor(km, scoreScaleFor(current)) * speedFactor(seconds))
    setPin(point)
    setResults((r) => [...r, { country: current, guess: point, nearest, km, seconds, score }])
    setPhase('reveal')
    phaseRef.current = 'reveal'

    // Fly the camera out to see both the guess and the answer
    const centre = midpoint(point, nearest)
    const v = view.current
    v.targetLat = clampLat(centre.lat)
    v.targetLon = centre.lon
    const base = isState(current) ? 1.6 : 2.2
    v.targetDist = Math.min(Math.max(base + angleBetween(point, nearest) * 1.2, MIN_DIST), MAX_DIST)

    play(() => sounds.reveal(score))
    const name = placeName(current)
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
    setResults((r) => [
      ...r,
      { country: current, guess: null, nearest: null, km: null, seconds: ROUND_SECONDS, score: 0 },
    ])
    setPhase('reveal')
    phaseRef.current = 'reveal'
    const centre = geoCentre(current)
    const v = view.current
    v.targetLat = clampLat(centre.lat)
    v.targetLon = centre.lon
    v.targetDist = isState(current) ? 1.6 : 2.2
    play(() => sounds.reveal(0))
    announce(`Time's up! It was ${placeName(current)}. 0 points.`)
  }

  function resetClock() {
    clock.current = 0
    setElapsed(0)
  }

  // Moves the round's clock forward, by the timer or by asking for a clue,
  // and gives out clues, the 10 second warning and the time-up as it goes
  function advanceClock(to: number) {
    if (phaseRef.current !== 'guessing' || !current) return
    const from = clock.current
    const now = Math.min(to, ROUND_SECONDS)
    clock.current = now
    setElapsed(now)
    CLUE_TIMES.forEach((at, i) => {
      const clue = clues[i]
      if (clue && from < at && now >= at) {
        play(sounds.pin)
        announce(`Clue. ${clue.label}: ${clue.value}.`)
      }
    })
    if (!timerOn) return
    const warnAt = ROUND_SECONDS - 10
    if (from < warnAt && now >= warnAt) announce('10 seconds left.')
    if (now >= ROUND_SECONDS) timeUp()
  }

  function takeClue() {
    const nextAt = CLUE_TIMES.find((at) => at > clock.current)
    if (nextAt !== undefined) advanceClock(nextAt)
  }

  // The timer ticks only while guessing with the timer on, and not while
  // the tab is hidden. A long gap between ticks (a sleeping laptop) counts
  // as a quarter of a second, so nobody loses a round to it.
  const advanceRef = useRef(advanceClock)
  useEffect(() => {
    advanceRef.current = advanceClock
  })
  useEffect(() => {
    if (phase !== 'guessing' || !timerOn) return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(now - last, 250) / 1000
      last = now
      if (!document.hidden) advanceRef.current(clock.current + delta)
    }, 100)
    return () => clearInterval(timer)
  }, [phase, timerOn, round])

  function next() {
    if (round + 1 >= ROUNDS) {
      setPhase('summary')
      view.current.spin = true
      view.current.targetDist = 3
      play(sounds.finish)
      announce(`Game over. You scored ${total} out of ${ROUNDS * MAX_SCORE} points.`)
      return
    }
    setRound(round + 1)
    setPin(null)
    resetClock()
    setPhase('guessing')
    announce(roundPrompt(round + 2))
  }

  // Keyboard play: the crosshair in the middle of the screen is the aim.
  // Arrow keys spin the globe under it, Space drops a pin, Enter guesses.
  function onGlobeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (phase !== 'guessing') return
    const v = view.current
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
  // working when the pointer leaves the globe.
  const gesture = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    pinched: false,
    pinchSpread: 0,
  })

  function onGlobePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const g = gesture.current
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (g.pointers.size === 1) {
      g.startX = event.clientX
      g.startY = event.clientY
      g.pinched = false
    } else {
      g.pinched = true
      g.pinchSpread = spread(g.pointers)
    }
    view.current.spin = false
  }

  // The window listeners outlive any single render, so they call the
  // latest placePin through a ref
  const placePinRef = useRef(placePin)
  useEffect(() => {
    placePinRef.current = placePin
  })

  useEffect(() => {
    const g = gesture.current
    const move = (e: globalThis.PointerEvent) => {
      const p = g.pointers.get(e.pointerId)
      if (!p) return
      const v = view.current
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (g.pointers.size >= 2) {
        const now = spread(g.pointers)
        if (g.pinchSpread > 0 && now > 0) zoomBy(v, g.pinchSpread / now)
        g.pinchSpread = now
        return
      }
      // Spin speed follows the zoom, so the map moves with the pointer
      const k = 0.2 * ((v.dist - 0.8) / 2.2)
      v.targetLon -= dx * k
      v.targetLat = clampLat(v.targetLat + dy * k)
    }
    const up = (e: globalThis.PointerEvent) => {
      if (!g.pointers.delete(e.pointerId)) return
      if (g.pointers.size > 0) {
        g.pinchSpread = 0
        return
      }
      if (e.type === 'pointercancel' || g.pinched) return
      const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY)
      const globe = globeRef.current
      if (moved > 6 || phaseRef.current !== 'guessing' || !globe) return
      const rect = globe.getBoundingClientRect()
      const point = pickOnGlobe(
        view.current,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
      )
      if (point) placePinRef.current(point)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  function onGlobeWheel(event: WheelEvent<HTMLDivElement>) {
    // Trackpads send many small deltas, mouse wheels a few big ones;
    // an exponential keeps both smooth
    zoomBy(view.current, Math.exp(event.deltaY * 0.0015))
  }

  const canZoomIn = (dist: number) => dist > MIN_DIST + 0.001
  const canZoomOut = (dist: number) => dist < MAX_DIST - 0.001

  const reveal =
    phase === 'reveal' && lastResult
      ? { guess: lastResult.guess, nearest: lastResult.nearest, country: lastResult.country }
      : null

  return (
    <div className="app">
      <header className="topbar">
        <p className="brand">
          Shape Guesser
          <span className="byline">
            by <a href={PORTFOLIO_URL}>Mikaela Johansson</a>
          </span>
        </p>
        <div className="settings">
          {/* A time limit you can't turn off fails WCAG 2.2.1, and not
              everyone can find a place in 60 seconds */}
          <button
            type="button"
            className="chip-button"
            aria-pressed={timerOn}
            onClick={() => setTimerOn(!timerOn)}
          >
            Timer {timerOn ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="chip-button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn(!soundOn)}
          >
            Sound {soundOn ? 'on' : 'off'}
          </button>
        </div>
      </header>

      <div
        ref={globeRef}
        className="globe"
        tabIndex={phase === 'guessing' ? 0 : -1}
        role="application"
        aria-label="Globe"
        aria-describedby="globe-help"
        onKeyDown={onGlobeKeyDown}
        onPointerDown={onGlobePointerDown}
        onWheel={onGlobeWheel}
      >
        <Globe
          view={view}
          reducedMotion={reducedMotion}
          pin={phase === 'guessing' || phase === 'reveal' ? pin : null}
          reveal={reveal}
        />
        {phase === 'guessing' && <div className="crosshair" aria-hidden="true" />}
      </div>

      <ZoomButtons view={view} canZoomIn={canZoomIn} canZoomOut={canZoomOut} />
      <p id="globe-help" className="sr-only">
        Arrow keys spin the globe under the crosshair in the middle, hold Shift for bigger steps. Plus
        and minus zoom. Space drops a pin, Enter guesses, C gives a clue.
      </p>

      {phase === 'intro' && (
        <section className="panel intro" aria-labelledby="intro-title">
          <h1 id="intro-title">Shape Guesser</h1>
          <p>
            You get a shape: a country or a US state. Find it on the globe and drop a pin. The
            closer and faster you are, the more points: {ROUNDS} rounds, up to{' '}
            {points(MAX_SCORE)} points each. Stuck? Clues appear as time goes by.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => start(true)}>
              Play today’s challenge
            </button>
            <button type="button" onClick={() => start(false)}>
              Random shapes
            </button>
          </div>
          <details className="how">
            <summary>How to play</summary>
            <ul>
              <li>
                <strong>Mouse or touch:</strong> drag to spin, scroll, pinch or use the + and −
                buttons to zoom, click to drop a pin, then press Guess.
              </li>
              <li>
                <strong>Keyboard:</strong> arrow keys spin the globe under the crosshair, + and −
                zoom, Space drops a pin, Enter guesses, C gives a clue.
              </li>
              <li>
                <strong>Time and clues:</strong> each round has {ROUND_SECONDS} seconds. The
                population comes after {CLUE_TIMES[0]} seconds, the part of the world after{' '}
                {CLUE_TIMES[1]} and the first letter after {CLUE_TIMES[2]}. Getting a clue early
                skips the clock ahead to it.
              </li>
              <li>
                <strong>Speed bonus:</strong> guess straight away and you keep all your points; at
                the end of the time, half. Turn the timer off at the top to play without a time
                limit; clues then only come when you ask, and still cost the same.
              </li>
              <li>
                Inside the shape is a perfect score. Outside, distance is measured to its nearest
                border, not its centre.
              </li>
            </ul>
          </details>
        </section>
      )}

      {phase === 'guessing' && current && (
        <>
          <section className="panel round" aria-label={`Round ${round + 1} of ${ROUNDS}`}>
            <p className="eyebrow">
              Round {round + 1} / {ROUNDS} · {points(total)} points
            </p>
            <Silhouette country={current} />
            <p className="prompt">Where is this?</p>
            {timerOn && (
              <div className="clock" aria-hidden="true">
                <div
                  className="clock-fill"
                  style={{ width: `${(1 - elapsed / ROUND_SECONDS) * 100}%` }}
                />
              </div>
            )}
            <p className="speed">
              {timerOn && `${Math.ceil(ROUND_SECONDS - elapsed)} s left · `}
              Speed bonus {percent(speedFactor(elapsed))}
            </p>
            {cluesShown > 0 && (
              <dl className="clues">
                {clues.slice(0, cluesShown).map((clue) => (
                  <div key={clue.label}>
                    <dt>{clue.label}</dt>
                    <dd>{clue.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {cluesShown < clues.length && (
              <button type="button" className="chip-button clue-button" onClick={takeClue}>
                Get a clue
              </button>
            )}
          </section>
          <div className="guess-bar">
            <button type="button" className="primary" disabled={!pin} onClick={() => guess()}>
              {pin ? 'Guess' : 'Drop a pin on the globe'}
            </button>
          </div>
        </>
      )}

      {phase === 'reveal' && lastResult && (
        <RevealPanel
          result={lastResult}
          isLast={round + 1 >= ROUNDS}
          reducedMotion={reducedMotion}
          onNext={next}
          buttonRef={nextRef}
        />
      )}

      {phase === 'summary' && (
        <SummaryPanel
          results={results}
          daily={daily}
          reducedMotion={reducedMotion}
          headingRef={summaryRef}
          onPlay={start}
          announce={announce}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}

function RevealPanel({
  result,
  isLast,
  reducedMotion,
  onNext,
  buttonRef,
}: {
  result: Result
  isLast: boolean
  reducedMotion: boolean
  onNext: () => void
  buttonRef: RefObject<HTMLButtonElement | null>
}) {
  const km = useCountUp(Math.round(result.km ?? 0), 1100, reducedMotion)
  const score = useCountUp(result.score, 1300, reducedMotion)
  const perfect = result.km === 0
  const timedOut = result.km === null
  return (
    <section className="panel reveal" aria-labelledby="reveal-title">
      <p className="eyebrow">{timedOut ? 'Time’s up! It was' : perfect ? 'Spot on!' : 'It was'}</p>
      <h2 id="reveal-title">{placeName(result.country)}</h2>
      {/* The numbers count up visually; screen readers get the final values
          from the announcement instead of every step */}
      <dl className="stats" aria-hidden="true">
        <div>
          <dt>Distance</dt>
          <dd>{timedOut ? '–' : perfect ? 'Inside!' : `${points(km)} km`}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{Math.round(result.seconds)} s</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd className="score">{points(score)}</dd>
        </div>
      </dl>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${(score / MAX_SCORE) * 100}%` }} />
      </div>
      <button ref={buttonRef} type="button" className="primary" onClick={onNext}>
        {isLast ? 'See results' : 'Next round'}
      </button>
    </section>
  )
}

function SummaryPanel({
  results,
  daily,
  reducedMotion,
  headingRef,
  onPlay,
  announce,
}: {
  results: Result[]
  daily: boolean
  reducedMotion: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  onPlay: (daily: boolean) => void
  announce: (message: string) => void
}) {
  const total = results.reduce((sum, r) => sum + r.score, 0)
  const shown = useCountUp(total, 1500, reducedMotion)
  const squares = results.map((r) => scoreSquare(r.score)).join('')

  async function share() {
    const text = [
      `Shape Guesser${daily ? ` ${todayKey()}` : ''}: ${points(total)} / ${points(ROUNDS * MAX_SCORE)}`,
      squares,
      GAME_URL,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      announce('Result copied to the clipboard.')
    } catch {
      announce('Copying failed. Your browser blocked the clipboard.')
    }
  }

  return (
    <section className="panel summary" aria-labelledby="summary-title">
      <h2 id="summary-title" ref={headingRef} tabIndex={-1}>
        {daily ? 'Today’s score' : 'Your score'}
      </h2>
      <p className="total" aria-hidden="true">
        {points(shown)}
        <span> / {points(ROUNDS * MAX_SCORE)}</span>
      </p>
      <p className="sr-only">
        {total} out of {ROUNDS * MAX_SCORE} points.
      </p>
      <ol className="rounds">
        {results.map((r, i) => (
          <li key={i}>
            <span aria-hidden="true">{scoreSquare(r.score)}</span>
            <span className="name">{placeName(r.country)}</span>
            <span className="km">
              {r.km === null ? 'time’s up' : r.km === 0 ? 'inside' : formatKm(r.km)}
            </span>
            <span className="pts">{points(r.score)}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" className="primary" onClick={share}>
          Copy result
        </button>
        <button type="button" onClick={() => onPlay(false)}>
          Play random shapes
        </button>
      </div>
    </section>
  )
}

// On-screen zoom buttons, for anyone without a scroll wheel or pinch.
// Disabled at the zoom limits, which is checked a few times a second
// because the distance lives in the per-frame view, not React state.
function ZoomButtons({
  view,
  canZoomIn,
  canZoomOut,
}: {
  view: RefObject<View>
  canZoomIn: (dist: number) => boolean
  canZoomOut: (dist: number) => boolean
}) {
  const [dist, setDist] = useState(view.current.targetDist)
  useEffect(() => {
    const timer = setInterval(() => setDist(view.current.targetDist), 200)
    return () => clearInterval(timer)
  }, [view])
  const zoom = (factor: number) => {
    zoomBy(view.current, factor)
    setDist(view.current.targetDist)
  }
  return (
    <div className="zoom" role="group" aria-label="Zoom">
      <button
        type="button"
        aria-label="Zoom in"
        disabled={!canZoomIn(dist)}
        onClick={() => zoom(1 / ZOOM_STEP)}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        disabled={!canZoomOut(dist)}
        onClick={() => zoom(ZOOM_STEP)}
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  )
}
