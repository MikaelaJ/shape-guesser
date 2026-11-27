// A setting remembered in localStorage, when the browser allows it.
// Read and set it through `.current`, like Svelte's own MediaQuery.
export class StoredBoolean {
  #key: string
  #value: boolean

  constructor(key: string, initial: boolean) {
    this.#key = key
    this.#value = $state(read(key, initial))
  }

  get current() {
    return this.#value
  }

  set current(next: boolean) {
    this.#value = next
    try {
      localStorage.setItem(this.#key, String(next))
    } catch {
      // Storage blocked - the setting just isn't remembered
    }
  }
}

// localStorage can hold anything (an old version, a browser extension, a
// curious player), so only 'true' and 'false' count. Anything else, or
// storage that's blocked, gives the default.
function read(key: string, initial: boolean) {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // Storage blocked
  }
  return initial
}
