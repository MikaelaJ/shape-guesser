// TEMPORARY while porting: removed in step 6, together with SvelteInReact.tsx.
//
// Mounts a Svelte component and lets React pass it new props later,
// without remounting it (the globe would lose its scene every render).
import { mount, unmount, type Component } from 'svelte'

// One piece of reactive state. $state.raw, not $state: the props include
// GeoJSON places, which $state would wrap in deep proxies (see AGENTS.md §1).
function signal<T>(initial: T) {
  let value = $state.raw(initial)
  return {
    get: () => value,
    set: (next: T) => {
      value = next
    },
  }
}

export function mountWithProps<P extends Record<string, unknown>>(
  component: Component<P>,
  target: Element,
  initial: P,
) {
  // One signal per prop, so a prop only counts as changed when its own
  // value does. React passes all props again on every render; with a
  // single shared signal, every effect reading any prop would rerun.
  const keys = Object.keys(initial) as (keyof P)[]
  const signals = new Map(keys.map((key) => [key, signal(initial[key])]))

  const props = {} as P
  for (const key of keys) {
    Object.defineProperty(props, key, { get: () => signals.get(key)!.get(), enumerable: true })
  }

  const instance = mount(component, { target, props })
  return {
    update(next: P) {
      for (const key of keys) signals.get(key)!.set(next[key])
    },
    destroy() {
      unmount(instance)
    },
  }
}
