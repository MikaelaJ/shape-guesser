// TEMPORARY while porting: removed in step 6, together with SvelteInReact.tsx.
//
// Mounts a Svelte component and lets React pass it new props later,
// without remounting it (the globe would lose its scene every render).
import { mount, unmount, type Component } from 'svelte'

export function mountWithProps<P extends Record<string, unknown>>(
  component: Component<P>,
  target: Element,
  initial: P,
) {
  // $state.raw, not $state: the props include GeoJSON places, which $state
  // would wrap in deep proxies (see AGENTS.md §1). Reassigning `current`
  // is what updates the component.
  let current = $state.raw(initial)

  // Each prop is a getter that reads `current`, so the component re-reads
  // it whenever `current` is replaced
  const props = {} as P
  for (const key of Object.keys(initial)) {
    Object.defineProperty(props, key, { get: () => current[key], enumerable: true })
  }

  const instance = mount(component, { target, props })
  return {
    update(next: P) {
      current = next
    },
    destroy() {
      unmount(instance)
    },
  }
}
