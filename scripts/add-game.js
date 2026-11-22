#!/usr/bin/env node
/**
 * Add a game to the library with its details from IGDB.
 *
 * Run by .github/workflows/add-game.yml, or locally:
 *   node --env-file=.env.local scripts/add-game.js --title "Hades" --system PC [--preview]
 *
 * Inputs (flags, or INPUT_* environment variables in the workflow):
 *   title*, system*, other-system, status, ownership, year, igdb-id, preview
 * Environment:
 *   IGDB_CLIENT_ID, IGDB_CLIENT_SECRET   Twitch app credentials (secrets)
 *   GITHUB_TOKEN                         token with Contents write on the repo
 *   GITHUB_REPOSITORY                    "owner/repo"
 *   DATA_BRANCH                          default "main"
 *   GITHUB_STEP_SUMMARY                  set by Actions; the summary is written there
 */

import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { createGitHubClient, GitHubError } from '../src/api/github.js'
import { mergeGames } from '../src/sync/merge.js'
import { serialize } from '../src/sync/engine.js'
import { SYSTEMS, STATUSES, OWNERSHIP } from '../src/constants.js'
import {
  createIgdbClient, findMatch, getTimeToBeat, getBundledGames, igdbFields, normalizeTitle, describe,
} from './igdb.js'

export const GAMES_PATH = 'data/games.json'
const MAX_MERGE_RETRIES = 3

// ── Inputs ───────────────────────────────────────────────────────────────────

/** Validate and normalise the form/flag values. Throws with a readable message. */
export function readInputs(raw) {
  const title = (raw.title ?? '').trim()
  if (!title) throw new Error('A title is required.')

  let system = (raw.system ?? '').trim()
  if (!system) throw new Error('A system is required.')
  if (system === 'Other') {
    system = (raw['other-system'] ?? '').trim()
    if (!system) throw new Error('System is "Other": fill in the other system name.')
  }

  const status = (raw.status ?? 'backlog').trim() || 'backlog'
  if (!STATUSES.includes(status)) throw new Error(`Unknown status "${status}". Use one of: ${STATUSES.join(', ')}.`)

  let ownership = (raw.ownership ?? '').trim()
  if (ownership === 'none') ownership = ''
  if (ownership && !OWNERSHIP.includes(ownership)) throw new Error(`Unknown ownership "${ownership}". Use one of: none, ${OWNERSHIP.join(', ')}.`)

  const year = (raw.year ?? '').trim()
  if (year && !/^\d{4}$/.test(year)) throw new Error(`Release year "${year}" should be four digits, like 2023.`)

  const igdbId = (raw['igdb-id'] ?? '').trim()
  if (igdbId && !/^\d+$/.test(igdbId)) throw new Error(`IGDB ID "${igdbId}" should be a number.`)

  const preview = raw.preview === true || raw.preview === 'true'
  return { title, system, status, ownership, year: year || null, igdbId: igdbId || null, preview }
}

// ── Library update ───────────────────────────────────────────────────────────

/** The existing library entry for this IGDB game, if any. */
export function findExisting(games, fields, inputs) {
  const byId = games.find(g => g.igdbId && g.igdbId === fields.igdbId)
  if (byId) return byId
  const titles = new Set([normalizeTitle(inputs.title), normalizeTitle(fields.title)])
  return games.find(g => g.system === inputs.system && titles.has(normalizeTitle(g.title))) ?? null
}

const keepDone = (titles, previous = []) => {
  const done = new Map(previous.map(x => [typeof x === 'string' ? x : x.title, x]))
  return titles.map(title => ({ title, done: done.get(title)?.done ?? false }))
}

/**
 * Add the game, or refresh the IGDB details of the copy already in the library.
 * @returns {{ games: object[], game: object, action: 'added'|'updated' }}
 */
export function applyMatch(games, fields, inputs, now = Date.now()) {
  const existing = findExisting(games, fields, inputs)

  if (!existing) {
    const game = {
      id:           now,
      title:        fields.title,
      system:       inputs.system,
      genre:        fields.genre,
      status:       inputs.status,
      ownership:    inputs.ownership,
      franchise:    fields.franchise,
      timeToBeat:   fields.timeToBeat,
      rating:       null,
      notes:        '',
      cover:        fields.cover,
      released:     fields.released,
      developer:    fields.developer,
      criticScore:  fields.criticScore,
      gameModes:    fields.gameModes,
      perspectives: fields.perspectives,
      tags:         fields.tags,
      dlc:          keepDone(fields.dlc),
      ...(fields.bundled.length ? { includedGames: fields.bundled.map(title => ({ title, status: 'backlog', done: false })) } : {}),
      igdbId:       fields.igdbId,
      lastSynced:   now,
    }
    for (const k of Object.keys(game)) if (game[k] === undefined) delete game[k]
    return { games: [...games, game], game, action: 'added' }
  }

  // Refresh IGDB details; keep the owner's own fields (title, system, status,
  // ownership, rating, notes), a chosen cover/year, and done-states.
  const game = {
    ...existing,
    genre:        fields.genre        || existing.genre,
    franchise:    fields.franchise    || existing.franchise,
    timeToBeat:   fields.timeToBeat   ?? existing.timeToBeat,
    developer:    fields.developer    ?? existing.developer,
    criticScore:  fields.criticScore  ?? existing.criticScore,
    gameModes:    fields.gameModes.length    ? fields.gameModes    : existing.gameModes,
    perspectives: fields.perspectives.length ? fields.perspectives : existing.perspectives,
    tags:         fields.tags.length         ? fields.tags         : existing.tags,
    dlc:          fields.dlc.length ? keepDone(fields.dlc, existing.dlc) : existing.dlc,
    cover:        existing.cover    || fields.cover,
    released:     existing.released || fields.released,
    ...(!existing.includedGames?.length && fields.bundled.length
      ? { includedGames: fields.bundled.map(title => ({ title, status: 'backlog', done: false })) }
      : {}),
    igdbId:       fields.igdbId,
    lastSynced:   now,
  }
  for (const k of Object.keys(game)) if (game[k] === undefined) delete game[k]
  return { games: games.map(g => (g.id === existing.id ? game : g)), game, action: 'updated' }
}

/**
 * Commit the updated games on top of `headSha`. If the branch moved (the app
 * saved meanwhile), three-way merge with the new head and try again.
 */
export async function commitGames(github, { headSha, base, next, message }) {
  for (let attempt = 0; attempt <= MAX_MERGE_RETRIES; attempt++) {
    try {
      return await github.commitFiles({ parentSha: headSha, files: { [GAMES_PATH]: serialize(next) }, message })
    } catch (e) {
      if (!(e instanceof GitHubError && e.kind === 'conflict')) throw e
      headSha = await github.getHeadSha()
      const remote = JSON.parse((await github.readFiles(headSha, [GAMES_PATH]))[GAMES_PATH] ?? '[]')
      next = mergeGames(base, next, remote)
      base = remote
    }
  }
  throw new Error('The library kept changing while saving; run the workflow again.')
}

// ── Run ──────────────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{ outcome: 'added'|'updated'|'preview'|'no_match', summary: string }>}
 */
export async function run({ inputs, igdb, github, now = Date.now() }) {
  const lines = [`## Add game from IGDB`, '', `Looked for ${inputs.igdbId ? `IGDB ID ${inputs.igdbId}` : `**${inputs.title}** on **${inputs.system}**${inputs.year ? ` (released ${inputs.year})` : ''}`}.`, '']
  const { match, candidates, searched, widened, elsewhere } = await findMatch(igdb, inputs)
  const others = candidates.filter(c => c !== match).slice(0, 5)
  const scope = widened ? 'searched wider: up to 200 results plus every-word name matches' : 'first search'

  if (!match) {
    lines.push(`No confident match for ${searched} (${scope}). The library was not changed.`, '')
    if (others.length) {
      lines.push('Closest IGDB results on this system. Run the workflow again with one of these **IGDB IDs**:', '')
      for (const c of others) lines.push(`- ${describe(c)}`)
    } else if (elsewhere) {
      const on = (elsewhere.platforms ?? []).map(p => p.name).join(', ') || 'no systems'
      lines.push(
        `IGDB has **${elsewhere.name}** (IGDB ID ${elsewhere.id}), but lists it only for: ${on}. It wasn't used because you chose ${inputs.system}.`,
        '',
        `If you do own it on ${inputs.system}, run the workflow again with IGDB ID **${elsewhere.id}**.`,
      )
    } else {
      lines.push(`IGDB has nothing matching that title on ${inputs.system}. Check the spelling and the system, or try fewer words.`)
    }
    return { outcome: 'no_match', summary: lines.join('\n') }
  }

  const [timeToBeat, bundled] = await Promise.all([
    getTimeToBeat(igdb, match.id).catch(() => null),
    getBundledGames(igdb, match.id).catch(() => []),
  ])
  const fields = igdbFields(match, { timeToBeat, bundled })

  lines.push(`**Match:** ${describe(match)}${widened ? ' (found by the wider search)' : ''}`, '')
  if (fields.cover) lines.push(`<img src="${fields.cover}" alt="" height="160">`, '')
  lines.push(
    `| Field | Value |`, `| --- | --- |`,
    `| Genre | ${fields.genre || '–'} |`,
    `| Developer | ${fields.developer ?? '–'} |`,
    `| Franchise | ${fields.franchise || '–'} |`,
    `| Time to beat | ${fields.timeToBeat != null ? `${fields.timeToBeat} h` : '–'} |`,
    `| DLC | ${fields.dlc.length} |`,
    `| Included games | ${fields.bundled.length} |`,
    '',
  )
  if (others.length) {
    lines.push('<details><summary>Other results</summary>', '')
    for (const c of others) lines.push(`- ${describe(c)}`)
    lines.push('', 'Wrong game? Run again with the right **IGDB ID**.', '</details>', '')
  }

  const headSha = await github.getHeadSha()
  const base = JSON.parse((await github.readFiles(headSha, [GAMES_PATH]))[GAMES_PATH] ?? '[]')
  const { games, game, action } = applyMatch(base, fields, inputs, now)

  if (inputs.preview) {
    lines.push(`Preview only: this would have been **${action}** as "${game.title}" (${game.system}). Nothing was committed.`)
    return { outcome: 'preview', summary: lines.join('\n') }
  }

  const verb = action === 'added' ? 'Add' : 'Update'
  const sha = await commitGames(github, {
    headSha, base, next: games,
    message: `${verb} from IGDB: ${game.title} (${game.system})`,
  })
  lines.push(action === 'added'
    ? `**Added** "${game.title}" (${game.system}, ${game.status}) in commit \`${sha.slice(0, 7)}\`.`
    : `**Updated** the IGDB details of "${game.title}" (${game.system}), already in the library, in commit \`${sha.slice(0, 7)}\`. Your status, ownership, rating and notes were kept.`)
  lines.push('', 'The app shows it the next time you switch back to it.')
  return { outcome: action, summary: lines.join('\n') }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function rawInputs(argv, env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'title':        { type: 'string' },
      'system':       { type: 'string' },
      'other-system': { type: 'string' },
      'status':       { type: 'string' },
      'ownership':    { type: 'string' },
      'year':         { type: 'string' },
      'igdb-id':      { type: 'string' },
      'preview':      { type: 'boolean' },
    },
  })
  const fromEnv = name => env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`]
  const out = {}
  for (const k of ['title', 'system', 'other-system', 'status', 'ownership', 'year', 'igdb-id', 'preview']) {
    out[k] = values[k] ?? fromEnv(k)
  }
  return out
}

function requireEnv(env, name) {
  if (!env[name]) throw new Error(`Missing ${name}. ${name.startsWith('IGDB') ? 'Add it under Settings → Secrets and variables → Actions → Secrets.' : ''}`.trim())
  return env[name]
}

async function main() {
  const env = process.env
  const write = text => {
    console.log(text)
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text + '\n')
  }
  try {
    const inputs = readInputs(rawInputs(process.argv.slice(2), env))
    if (inputs.system && !SYSTEMS.includes(inputs.system)) console.log(`Note: "${inputs.system}" is not a known system, so the search is not limited to a platform.`)
    const [owner, repo] = requireEnv(env, 'GITHUB_REPOSITORY').split('/')
    const igdb = createIgdbClient({ clientId: requireEnv(env, 'IGDB_CLIENT_ID'), clientSecret: requireEnv(env, 'IGDB_CLIENT_SECRET') })
    const github = createGitHubClient({ token: requireEnv(env, 'GITHUB_TOKEN'), owner, repo, branch: env.DATA_BRANCH || 'main' })
    const { outcome, summary } = await run({ inputs, igdb, github })
    write(summary)
    if (outcome === 'no_match') process.exitCode = 1
  } catch (e) {
    write(`## Add game from IGDB\n\n**Failed:** ${e.message}`)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
