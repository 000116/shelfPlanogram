import type { ChocoSku } from '../types'

export default function RightDrawer({
  open, skus, module, auto, capacityPct, search,
  onSearch, onSelectAll, onClear, onToggleAuto, onToggleSku, onClose,
}: {
  open: boolean
  skus: ChocoSku[]
  module: string
  auto: boolean
  capacityPct: number
  search: string
  onSearch: (v: string) => void
  onSelectAll: () => void
  onClear: () => void
  onToggleAuto: () => void
  onToggleSku: (name: string, checked: boolean) => void
  onClose: () => void
}) {
  const searchVal = search.toLowerCase().trim()
  const total = skus.length
  const selectedCount = skus.filter(s => s.selected).length

  const LOCKED_GROUP = 'KİLİTLİ — ALT RAF'
  const groups: Record<string, ChocoSku[]> = {}
  if (module === '3') groups[LOCKED_GROUP] = []
  for (const s of skus) {
    if (searchVal && !s.name.toLowerCase().includes(searchVal)) continue
    if (module === '3' && s.locked) groups[LOCKED_GROUP].push(s)
    else {
      const b = s.brand || 'Diğer'
      if (!groups[b]) groups[b] = []
      groups[b].push(s)
    }
  }
  const BRAND_ORDER = ['Eti', 'Ülker']
  const groupNames = Object.keys(groups).sort((a, b) => {
    if (a === LOCKED_GROUP) return -1
    if (b === LOCKED_GROUP) return 1
    if (a === 'Diğer') return 1
    if (b === 'Diğer') return -1
    const aOrder = BRAND_ORDER.indexOf(a)
    const bOrder = BRAND_ORDER.indexOf(b)
    if (aOrder !== -1 || bOrder !== -1) {
      if (aOrder === -1) return 1
      if (bOrder === -1) return -1
      return aOrder - bOrder
    }
    return a.localeCompare(b, 'tr')
  }).filter(g => groups[g].length > 0)

  return (
    <aside className={`right-drawer ${open ? 'open' : ''}`}>
      <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="drawer-title" style={{ margin: 0 }}>
            {module === 'gondol' ? 'Gondolbaşı Ürün Listesi' : 'Çeşit Seçimi'}
          </div>
          <div className="drawer-stats" style={{ marginTop: 4 }}>
            {module === 'gondol' ? (
              <>
                <span>Toplam Çeşit: {total}</span>
                <span>Raftaki Ürün: {selectedCount}</span>
              </>
            ) : (
              <>
                <span>Seçili: {selectedCount} / {total}</span>
                <span>Kapasite: %{capacityPct || 0} dolu</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--sub)', lineHeight: 1, padding: 4 }}
        >&times;</button>
      </div>

      <div className="drawer-actions">
        <button className="drawer-btn" onClick={onSelectAll}>Önerilenleri Seç</button>
        <button className="drawer-btn" onClick={onClear}>Temizle</button>
        <button className={`drawer-btn ${auto ? 'active-auto' : ''}`} onClick={onToggleAuto}>
          {auto ? 'Otomatik Mod: Açık' : 'Otomatik Öner'}
        </button>
      </div>

      <div className="drawer-search-container">
        <input
          type="text"
          placeholder="Ürün ara..."
          className="drawer-search"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className="drawer-list-wrap">
        {groupNames.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>Ürün bulunamadı.</div>
        )}
        {groupNames.map(gName => (
          <div className="drawer-group" key={gName}>
            <div className="drawer-group-title">{gName} ({groups[gName].length})</div>
            {groups[gName].map(s => (
              <div className="drawer-item" key={s.name}>
                <div className="drawer-item-left">
                  <span className="brand-dot" style={{ background: s.color }} />
                  <span className="drawer-item-name" title={s.name}>{s.label}</span>
                  <span className="drawer-item-score" style={{ marginLeft: 4 }}>
                    {module === 'gondol' ? `(${s.score} sat. · ${s.width_cm} cm)` : `(${s.score})`}
                  </span>
                </div>
                <div className="drawer-item-right">
                  {module === 'gondol' ? (
                    s.selected && s.shelf && (
                      <span className="drawer-badge" style={{ background: '#2e7d32', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        {s.shelf}
                      </span>
                    )
                  ) : (
                    s.shelf && (
                      <span className={`drawer-badge ${s.locked ? 'locked' : ''}`}>
                        {s.locked ? 'Kilitli' : `Raf ${s.shelf}`} · {s.facing}x
                      </span>
                    )
                  )}
                  <input
                    type="checkbox"
                    className="drawer-checkbox"
                    checked={!!s.selected}
                    disabled={module !== 'gondol' && s.locked && !!s.selected}
                    onChange={e => onToggleSku(s.name, e.target.checked)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
