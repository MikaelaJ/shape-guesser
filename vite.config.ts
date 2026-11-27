import { svelte } from '@sveltejs/vite-plugin-svelte'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The game is served from mikaelajohansson.com/outlinr/, so every
// asset path starts with that.
// React and Svelte run side by side while the components are ported;
// the React plugin goes once the last one is.
export default defineConfig({
  base: '/outlinr/',
  plugins: [react(), svelte()],
})
