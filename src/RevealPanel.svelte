<script lang="ts">
  import { countUp } from './countUp.svelte'
  import { MAX_SCORE, placeName } from './geo'
  import { points, type Result } from './result'

  let {
    result,
    isLast,
    reducedMotion,
    onNext,
  }: {
    result: Result
    isLast: boolean
    reducedMotion: boolean
    onNext: () => void
  } = $props()

  const km = countUp(() => Math.round(result.km ?? 0), 1100, () => reducedMotion)
  const score = countUp(() => result.score, 1300, () => reducedMotion)
  const perfect = $derived(result.km === 0)
  const timedOut = $derived(result.km === null)

  // Focus moves to where the player acts next: the button, as soon as the
  // result is shown
  let button = $state<HTMLButtonElement>()
  $effect(() => {
    button?.focus()
  })
</script>

<section class="panel reveal" aria-labelledby="reveal-title">
  <p class="eyebrow">{timedOut ? 'Time’s up! It was' : perfect ? 'Spot on!' : 'It was'}</p>
  <h2 id="reveal-title">{placeName(result.country)}</h2>
  <!-- The numbers count up visually; screen readers get the final values
       from the announcement instead of every step -->
  <dl class="stats" aria-hidden="true">
    <div>
      <dt>Distance</dt>
      <dd>{timedOut ? '–' : perfect ? 'Inside!' : `${points(km.current)} km`}</dd>
    </div>
    <div>
      <dt>Time</dt>
      <dd>{Math.round(result.seconds)} s</dd>
    </div>
    <div>
      <dt>Points</dt>
      <dd class="score">{points(score.current)}</dd>
    </div>
  </dl>
  <div class="meter" aria-hidden="true">
    <div class="meter-fill" style:width="{(score.current / MAX_SCORE) * 100}%"></div>
  </div>
  <button bind:this={button} type="button" class="primary" onclick={onNext}>
    {isLast ? 'See results' : 'Next round'}
  </button>
</section>
