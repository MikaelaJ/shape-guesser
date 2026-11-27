// TEMPORARY while porting: removed in step 6, together with
// svelteInReact.svelte.ts. Lets the React app show a Svelte component, so
// each ported component can be tried in the real game straight away.
import { useLayoutEffect, useRef } from 'react'
import type { Component } from 'svelte'
import { mountWithProps } from './svelteInReact.svelte'

export function SvelteInReact<P extends Record<string, unknown>>({
  component,
  props,
}: {
  component: Component<P>
  props: P
}) {
  const host = useRef<HTMLDivElement>(null)
  const mounted = useRef<ReturnType<typeof mountWithProps<P>> | null>(null)
  // The latest props, so mounting doesn't depend on them: the component is
  // mounted once, and new props go through update() below
  const latest = useRef(props)

  // Layout effects run before the browser paints, so there's no flash of
  // an empty box before the Svelte component appears
  useLayoutEffect(() => {
    const m = mountWithProps(component, host.current!, latest.current)
    mounted.current = m
    return () => {
      m.destroy()
      mounted.current = null
    }
  }, [component])

  useLayoutEffect(() => {
    latest.current = props
    mounted.current?.update(props)
  })

  // display: contents, so the wrapper doesn't change the layout
  return <div ref={host} style={{ display: 'contents' }} />
}
