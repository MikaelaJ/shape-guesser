# Shape Guesser

A small geo mini-game on a 3D globe: you get the outline of a country, find it on the globe and drop a pin. The closer you are, the more points. Five rounds, a daily challenge that's the same for everyone, and a shareable result.

**Play:** https://mikaelajohansson.com/shape-guesser/

Built by [Mikaela Johansson](https://mikaelajohansson.com) as a focused, finished slice of the kind of thing I'd love to build: one mechanic, polished, that hopefully makes people smile.

## How it plays

1. A country's silhouette appears, shown on its own projection so the shape isn't stretched and its position gives nothing away.
2. Spin the globe and drop a pin where you think it is.
3. An arc flies from your pin to the answer, the country lights up, and the distance and points count up.
4. After five rounds you get your total and a row of 🟩🟨🟥 to share.

**Scoring:** a pin inside the country is a perfect 5 000. Outside, distance is measured to the country's **nearest border, not its centre**. Measuring to the centre would punish a click just inside Russia's border for being thousands of kilometres from its middle. Points then fall off smoothly: `5000 × e^(−km / 2000)`, so 500 km away gives about 3 900 and 2 000 km about 1 800.

## Accessibility

Accessibility is a core part of how I work (I'm CPACC certified), so it's built in rather than added on:

- **Fully playable with the keyboard.** A crosshair sits in the middle of the screen: the arrow keys spin the globe under it (Shift for bigger steps), + and − zoom, Space drops a pin, Enter guesses. On a globe this falls out naturally; no separate "accessible mode".
- **Screen reader announcements** for each round, the pin position and the result ("It was Togo. You were 1,397 km away. 2,487 points."). Counting-up numbers are hidden from screen readers, which get the final values instead of every step.
- **Focus moves to where you act next:** the globe at the start of a round, "Next round" after a guess, the score at the end.
- **Respects "reduce motion":** no idle spin, no camera easing, the arc and numbers appear at their final state.
- **Sound** is short synthesised tones that only play after you do something, with an on/off toggle that's remembered.
- **Contrast** meets WCAG AA, and buttons are at least 44 px tall.

What it doesn't do: the game is about recognising a *visual* shape, so it isn't playable without sight. The silhouette has a text label, but describing the outline would give the answer away. That's a limit of the concept, not something I'd want to paper over.

## Tech

- **Vite + React + TypeScript**
- **Three.js via react-three-fiber** (and drei for the fat animated line)
- **d3-geo** for projections, distances, point-in-country tests and great-circle arcs
- **Country borders:** [Natural Earth](https://www.naturalearthdata.com/) 1:50m (public domain), via the [world-atlas](https://github.com/topojson/world-atlas) package

### How it fits together

| File | What it does |
| --- | --- |
| `src/geo.ts` | Country data, lat/lon ↔ 3D conversion, distance to nearest border, scoring, arcs |
| `src/game.ts` | Seeded random picks for the daily challenge (no backend needed), share squares |
| `src/view.ts` | The camera model, and picking: which point on the globe is under the pointer |
| `src/Globe.tsx` | The 3D scene: textured globe, highlight, fresnel atmosphere, markers, animated arc |
| `src/App.tsx` | Game flow, keyboard and pointer input, announcements, focus management |
| `src/Silhouette.tsx` | The country outline, on an azimuthal equal-area projection centred on it |

Some decisions worth explaining:

- **The camera orbits; the globe never rotates.** A point on the globe's surface then converts straight to latitude and longitude, and the camera is fully described by four numbers (lat, lon, distance, field of view).
- **Picking is plain geometry.** Because the camera is just those numbers, finding the point under the pointer is a ray from the camera intersected with a unit sphere (`pickOnGlobe` in `view.ts`), instead of relying on three.js pointer events. It's easy to test and reason about.
- **The globe texture is drawn once** from the GeoJSON onto a 4096 × 2048 canvas with d3-geo's equirectangular projection, which maps directly onto a three.js sphere. The answer highlight is a second, transparent texture drawn per round.
- **The daily challenge** uses a seeded random number generator keyed on the date, so everyone gets the same five countries without a server.
- **Disputed areas** that the data draws as separate shapes (Western Sahara, Somaliland, Northern Cyprus) are shown on the map but never asked about, so the game doesn't take a side.

## What I'd do next

- A small backend for a daily leaderboard (a serverless function and a tiny database)
- Difficulty levels, e.g. continents first, small countries later
- Load the map data separately to shrink the initial bundle (it's most of the 575 kB gzipped)
- Touch-specific polish: pinch to zoom
- Tests for the geo maths (distance to border, picking)

## How I used AI

<!-- TODO (Mikaela): write this section in your own words once you've gone
     through the code. Suggested points:
     - what you asked the AI tool to do, and what you decided yourself
     - what you checked, changed or rejected (e.g. three.js click events
       didn't fire reliably, so picking was rewritten as plain ray-sphere
       maths that's easier to verify)
     - which parts you can explain line by line
     GeoGuessr say they want people who can evaluate what AI produces, so
     this is worth being specific and honest about. -->

## Run it locally

```sh
pnpm install
pnpm dev
```

Then open http://localhost:5173/shape-guesser/. `pnpm build` makes a static build in `dist/`.

## Credits

Country borders: Natural Earth, public domain. Not affiliated with GeoGuessr.
