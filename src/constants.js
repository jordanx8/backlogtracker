/**
 * Choice lists shared by the add/edit form and the "Add game from IGDB"
 * workflow (scripts/ and .github/workflows/add-game.yml must stay in step).
 */

export const SYSTEMS = [
  // Current
  'Nintendo Switch', 'Nintendo Switch 2', 'PlayStation 5', 'PlayStation 4',
  'Xbox Series X/S', 'Xbox One', 'PC',
  // Last gen
  'PlayStation 3', 'Xbox 360', 'Wii U', 'Wii',
  // Nintendo handhelds
  'Nintendo 3DS', 'Nintendo DS', 'Game Boy Advance', 'Game Boy Color', 'Game Boy',
  // Nintendo home consoles
  'GameCube', 'Nintendo 64', 'Super Nintendo', 'NES',
  // PlayStation legacy
  'PlayStation 2', 'PlayStation',
  // Xbox legacy
  'Xbox',
  // Sega
  'Dreamcast', 'Sega Saturn', 'Sega Genesis',
  // Mobile
  'iOS', 'Android',
  'Other',
]

export const GENRES = [
  'Action', 'Action-Adventure', 'Adventure', 'Fighting', 'Horror',
  'JRPG', 'Metroidvania', 'Platformer', 'Puzzle', 'Racing',
  'Roguelike', 'RPG', 'Shooter', 'Simulation', 'Sports',
  'Strategy', 'Survival', 'Visual Novel', 'Other',
]

export const STATUSES  = ['backlog', 'playing', 'completed', 'shelved', 'wishlist']
export const OWNERSHIP = ['physical', 'digital', 'both']
