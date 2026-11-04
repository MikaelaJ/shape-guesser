import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The game is served from mikaelajohansson.com/outlinr/, so every
// asset path starts with that.
export default defineConfig({
  base: '/outlinr/',
  plugins: [react()],
})
