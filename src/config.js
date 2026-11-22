/**
 * Build-time configuration. None of these values are secret: they end up in
 * the published JavaScript. Set them in `.env.local` for dev, and as GitHub
 * repository variables for the Pages build (see README).
 */

// Read each variable by name: referencing the whole `import.meta.env` object
// would make Vite inline EVERY VITE_* variable from .env files into the bundle.
// The `?.` keeps this module importable outside Vite (unit tests).
export const config = {
  owner:    import.meta.env?.VITE_GITHUB_OWNER  || '',
  repo:     import.meta.env?.VITE_GITHUB_REPO   || '',
  branch:   import.meta.env?.VITE_GITHUB_BRANCH || 'main',
  proxyUrl: (import.meta.env?.VITE_IGDB_PROXY_URL || '').replace(/\/+$/, ''),
  dataDir:  'data',
}

/** Names of required settings that are missing, or [] when configured. */
export const missingConfig = [
  !config.owner && 'VITE_GITHUB_OWNER',
  !config.repo  && 'VITE_GITHUB_REPO',
].filter(Boolean)

if (missingConfig.length) {
  console.error(
    `[backlogtracker] Missing configuration: ${missingConfig.join(', ')}. ` +
    'Set them in .env.local (dev) or as repository variables (Pages build).'
  )
}

/** True when the IGDB lookup proxy is configured. */
export const igdbEnabled = Boolean(config.proxyUrl)
