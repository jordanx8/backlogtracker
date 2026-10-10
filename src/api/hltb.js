const SEARCH_URL = '/hltb-api/api/search'

const PAYLOAD_BASE = {
  searchType: 'games',
  searchPage: 1,
  size: 5,
  searchOptions: {
    games: {
      userId: 0,
      platform: '',
      sortCategory: 'popular',
      rangeCategory: 'main',
      rangeTime: { min: 0, max: 0 },
      gameplay: { perspective: '', flow: '', genre: '' },
      modifier: '',
    },
    users: { sortCategory: 'postcount' },
    filter: '',
    sort: 0,
    randomizer: 0,
  },
}

/**
 * Search HLTB for a game title.
 * Returns the best-matching result's main-story hours, or null if not found.
 * Routes through the Vite dev proxy to avoid CORS.
 */
export async function getHLTB(title) {
  const body = {
    ...PAYLOAD_BASE,
    searchTerms: title.trim().split(' '),
  }

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://howlongtobeat.com',
      'referer': 'https://howlongtobeat.com/',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HLTB request failed: ${res.status}`)

  const data = await res.json()
  if (!data?.data?.length) return null

  // Pick the result with the highest name similarity
  const titleLower = title.toLowerCase()
  const best = data.data
    .filter(r => r.comp_main > 0)
    .sort((a, b) => {
      const simA = similarity(a.game_name.toLowerCase(), titleLower)
      const simB = similarity(b.game_name.toLowerCase(), titleLower)
      return simB - simA
    })[0]

  if (!best) return null

  // comp_main is in seconds — convert to hours rounded to 1 decimal
  return Math.round(best.comp_main / 360) / 10
}

// Simple character-overlap similarity (good enough for title matching)
function similarity(a, b) {
  if (a === b) return 1
  const longer  = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  const editDist = levenshtein(longer, shorter)
  return (longer.length - editDist) / longer.length
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}
