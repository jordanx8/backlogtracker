import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site from /<repo>/; dev serves from the root
  base: command === 'build' ? '/backlogtracker/' : '/',
  plugins: [react()],
}))
