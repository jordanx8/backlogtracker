import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// ── Dev-only plugin: POST /save-data writes directly to public/data/ ──────────
function saveDataPlugin() {
  return {
    name: 'save-data',
    configureServer(server) {
      server.middlewares.use('/save-data', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { games, journal } = JSON.parse(body)
            const dataDir = path.resolve(import.meta.dirname, 'public/data')
            fs.mkdirSync(dataDir, { recursive: true })
            fs.writeFileSync(path.join(dataDir, 'games.json'),   JSON.stringify(games,   null, 2))
            fs.writeFileSync(path.join(dataDir, 'journal.json'), JSON.stringify(journal, null, 2))
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: e.message }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveDataPlugin()],
  server: {
    proxy: {
      // Twitch OAuth token endpoint (needed to get IGDB bearer token)
      '/twitch-token': {
        target: 'https://id.twitch.tv',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twitch-token/, '/oauth2/token'),
      },
      // IGDB API
      '/igdb-api': {
        target: 'https://api.igdb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/igdb-api/, ''),
      },
    },
  },
})
