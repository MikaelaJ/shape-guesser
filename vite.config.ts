import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The game is served from mikaelajohansson.com/shape-guesser/, so every
// asset path starts with that.
export default defineConfig({
  base: '/shape-guesser/',
  plugins: [react()],
})
