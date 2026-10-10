import Icon from './Icon'

export default function FilterBar({ filters, setFilters, sortBy, setSortBy, systems, genres, franchises }) {
  const set = (field, value) => setFilters(prev => ({ ...prev, [field]: value }))

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.system !== 'all' ||
    filters.genre !== 'all' ||
    filters.franchise !== 'all' ||
    filters.ownership !== 'all' ||
    filters.search !== ''

  return (
    <div className="filter-bar">
      <input
        className="search-input"
        type="search"
        placeholder="Search games..."
        value={filters.search}
        onChange={e => set('search', e.target.value)}
      />

      <div className="filter-group">
        <label>Status</label>
        <select value={filters.status} onChange={e => set('status', e.target.value)}>
          <option value="all">All</option>
          <option value="playing">Playing</option>
          <option value="backlog">Not Started</option>
          <option value="completed">Completed</option>
          <option value="shelved">Shelved</option>
        </select>
      </div>

      <div className="filter-group">
        <label>System</label>
        <select value={filters.system} onChange={e => set('system', e.target.value)}>
          <option value="all">All Systems</option>
          {systems.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {genres.length > 0 && (
        <div className="filter-group">
          <label>Genre</label>
          <select value={filters.genre} onChange={e => set('genre', e.target.value)}>
            <option value="all">All Genres</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}

      {franchises.length > 0 && (
        <div className="filter-group">
          <label>Franchise</label>
          <select value={filters.franchise} onChange={e => set('franchise', e.target.value)}>
            <option value="all">All Franchises</option>
            {franchises.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      <div className="filter-group">
        <label>Ownership</label>
        <select value={filters.ownership} onChange={e => set('ownership', e.target.value)}>
          <option value="all">Any</option>
          <option value="physical">Physical</option>
          <option value="digital">Digital</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Sort by</label>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="title">Title (A–Z)</option>
          <option value="title-desc">Title (Z–A)</option>
          <option value="system">System</option>
          <option value="rating">Rating ↓</option>
          <option value="rating-asc">Rating ↑</option>
          <option value="ttb">Time to Beat ↑</option>
          <option value="added">Date Added ↓</option>
          <option value="added-asc">Date Added ↑</option>
        </select>
      </div>

      {hasActiveFilters && (
        <button
          className="btn-ghost filter-clear"
          onClick={() => {
            setFilters({ status: 'all', system: 'all', genre: 'all', franchise: 'all', ownership: 'all', search: '' })
          }}
        ><Icon name="close" size={12} /> Clear</button>
      )}
    </div>
  )
}
