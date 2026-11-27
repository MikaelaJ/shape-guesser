<script lang="ts">
  import { countUp } from './countUp.svelte'
  import { ROUNDS, scoreSquare, todayKey } from './game'
  import { formatKm, MAX_SCORE, placeName } from './geo'
  import { GAME_URL, points, type Result } from './result'

  let {
    results,
    daily,
    reducedMotion,
    onPlay,
    announce,
  }: {
    results: Result[]
    daily: boolean
    reducedMotion: boolean
    onPlay: (daily: boolean) => void
    announce: (message: string) => void
  } = $props()

  const total = $derived(results.reduce((sum, r) => sum + r.score, 0))
  const shown = countUp(() => total, 1500, () => reducedMotion)
  const squares = $derived(results.map((r) => scoreSquare(r.score)).join(''))

  // Focus moves to the score when the game ends
  let heading = $state<HTMLHeadingElement>()
  $effect(() => {
    heading?.focus()
  })

  async function share() {
    const text = [
      `Outlinr${daily ? ` ${todayKey()}` : ''}: ${points(total)} / ${points(ROUNDS * MAX_SCORE)}`,
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
</script>

<section class="panel summary" aria-labelledby="summary-title">
  <h2 id="summary-title" bind:this={heading} tabindex="-1">
    {daily ? 'Today’s score' : 'Your score'}
  </h2>
  <p class="total" aria-hidden="true">
    {points(shown.current)}
    <span> / {points(ROUNDS * MAX_SCORE)}</span>
  </p>
  <p class="sr-only">
    {total} out of {ROUNDS * MAX_SCORE} points.
  </p>
  <ol class="rounds">
    {#each results as r, i (i)}
      <li>
        <span aria-hidden="true">{scoreSquare(r.score)}</span>
        <span class="name">{placeName(r.country)}</span>
        <span class="km">
          {r.km === null ? 'time’s up' : r.km === 0 ? 'inside' : formatKm(r.km)}
        </span>
        <span class="pts">{points(r.score)}</span>
      </li>
    {/each}
  </ol>
  <div class="actions">
    <button type="button" class="primary" onclick={share}>Copy result</button>
    <button type="button" onclick={() => onPlay(false)}>Play random shapes</button>
  </div>
</section>
