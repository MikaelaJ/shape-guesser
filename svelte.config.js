// Runes mode everywhere: legacy Svelte 4 syntax (export let, $:, on:click)
// is a compile error, not just a habit to avoid. See AGENTS.md.
export default {
  compilerOptions: {
    runes: true,
  },
}
