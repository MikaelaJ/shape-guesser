import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from 'react'
import { ROUNDS, pickCountries, scoreSquare, todayKey } from './game'
import {
  MAX_SCORE,
  angleBetween,
  distanceToCountry,
  formatKm,
  formatLatLon,
  midpoint,
  scoreFor,
  countryName,
  type Country,
  type LatLon,
} from './geo'
import { Globe } from './Globe'
import { useCountUp, useReducedMotion, useStoredBoolean } from './hooks'
import { Silhouette } from './Silhouette'
import { sounds } from './sound'
import { MAX_DIST, MIN_DIST, clampLat, pickOnGlobe, type View } from './view'

type Phase = 'intro' | 'guessing' | 'reveal' | 'summary'
type Result = { country: Country; guess: LatLon; nearest: LatLon; km: number; score: number }

const PORTFOLIO_URL = 'https://mikaelajohansson.com/'
const GAME_URL = 'https://mikaelajohansson.com/shape-guesser/'

const normaliseLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180
const points = (n: number) => n.toLocaleString('en-GB')

export default function App() {
  const reducedMotion = useReducedMotion()
  const [soundOn, setSoundOn] = useStoredBoolean('shape-guesser:sound', true)
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
  const [rounds, setRounds] = useState<Country[]>([])
  const [round, setRound] = useState(0)
  const [pin, setPin] = useState<LatLon | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [announcement, setAnnouncement] = useState('')

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

  // Move keyboard focus to wherever the player needs to act next
  useEffect(() => {
    if (phase === 'guessing') globeRef.current?.focus()
    if (phase === 'reveal') nextRef.current?.focus()
    if (phase === 'summary') summaryRef.current?.focus()
  }, [phase, round])

  const roundPrompt = (n: number) =>
    `Round ${n} of ${ROUNDS}. Which country has this shape? Find it on the globe.`

  function start(isDaily: boolean) {
    setDaily(isDaily)
    setRounds(pickCountries(isDaily ? todayKey() : null))
    setRound(0)
    setResults([])
    setPin(null)
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
    const { km, nearest } = distanceToCountry(current, point)
    const score = scoreFor(km)
    setPin(point)
    setResults((r) => [...r, { country: current, guess: point, nearest, km, score }])
    setPhase('reveal')

    // Fly the camera out to see both the guess and the answer
    const centre = midpoint(point, nearest)
    const v = view.current
    v.targetLat = clampLat(centre.lat)
    v.targetLon = centre.lon
    v.targetDist = Math.min(Math.max(2.2 + angleBetween(point, nearest) * 1.2, MIN_DIST), MAX_DIST)

    play(() => sounds.reveal(score))
    const name = countryName(current)
    announce(
      km === 0
        ? `Spot on, that's inside ${name}! ${score} points.`
        : `It was ${name}. You were ${formatKm(km)} away. ${score} points.`,
    )
  }

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
        v.targetDist = Math.max(MIN_DIST, v.targetDist - 0.3)
        break
      case '-':
        v.targetDist = Math.min(MAX_DIST, v.targetDist + 0.3)
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

  // Drag to spin; a press that barely moves is a click, which drops a pin
  // where the pointer is on the globe.
  function onGlobePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    let lastX = startX
    let lastY = startY
    view.current.spin = false
    const move = (e: globalThis.PointerEvent) => {
      const v = view.current
      const k = 0.2 * ((v.dist - 0.8) / 2.2)
      v.targetLon -= (e.clientX - lastX) * k
      v.targetLat = clampLat(v.targetLat + (e.clientY - lastY) * k)
      lastX = e.clientX
      lastY = e.clientY
    }
    const up = (e: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY)
      if (moved > 6 || phaseRef.current !== 'guessing') return
      const point = pickOnGlobe(
        view.current,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
      )
      if (point) placePin(point)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onGlobeWheel(event: WheelEvent<HTMLDivElement>) {
    const v = view.current
    v.targetDist = Math.min(MAX_DIST, Math.max(MIN_DIST, v.targetDist + event.deltaY * 0.002))
  }

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
        <button
          type="button"
          className="chip-button"
          aria-pressed={soundOn}
          onClick={() => setSoundOn(!soundOn)}
        >
          Sound {soundOn ? 'on' : 'off'}
        </button>
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
      <p id="globe-help" className="sr-only">
        Arrow keys spin the globe under the crosshair in the middle, hold Shift for bigger steps. Plus
        and minus zoom. Space drops a pin, Enter guesses.
      </p>

      {phase === 'intro' && (
        <section className="panel intro" aria-labelledby="intro-title">
          <h1 id="intro-title">Shape Guesser</h1>
          <p>
            You get the outline of a country. Find it on the globe and drop a pin. The closer you are,
            the more points: {ROUNDS} rounds, up to {points(MAX_SCORE)} points each.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => start(true)}>
              Play today’s challenge
            </button>
            <button type="button" onClick={() => start(false)}>
              Random countries
            </button>
          </div>
          <details className="how">
            <summary>How to play</summary>
            <ul>
              <li>
                <strong>Mouse or touch:</strong> drag to spin, scroll to zoom, click to drop a pin,
                then press Guess.
              </li>
              <li>
                <strong>Keyboard:</strong> arrow keys spin the globe under the crosshair, + and −
                zoom, Space drops a pin, Enter guesses.
              </li>
              <li>
                Inside the country is a perfect score. Outside, distance is measured to its nearest
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
            <p className="prompt">Which country is this?</p>
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
  const km = useCountUp(Math.round(result.km), 1100, reducedMotion)
  const score = useCountUp(result.score, 1300, reducedMotion)
  const perfect = result.km === 0
  return (
    <section className="panel reveal" aria-labelledby="reveal-title">
      <p className="eyebrow">{perfect ? 'Spot on!' : 'It was'}</p>
      <h2 id="reveal-title">{countryName(result.country)}</h2>
      {/* The numbers count up visually; screen readers get the final values
          from the announcement instead of every step */}
      <dl className="stats" aria-hidden="true">
        <div>
          <dt>Distance</dt>
          <dd>{perfect ? 'Inside!' : `${points(km)} km`}</dd>
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
            <span className="name">{countryName(r.country)}</span>
            <span className="km">{r.km === 0 ? 'inside' : formatKm(r.km)}</span>
            <span className="pts">{points(r.score)}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" className="primary" onClick={share}>
          Copy result
        </button>
        <button type="button" onClick={() => onPlay(false)}>
          Play random countries
        </button>
      </div>
    </section>
  )
}
