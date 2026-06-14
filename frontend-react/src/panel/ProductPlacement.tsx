import { useMemo, useRef, useState } from 'react'
import type { GondolProduct, ShelfKey } from './gondolConstants'
import { CLUSTER_MULT, SHELF_WIDTH_CM, recalcWidths, shortLabel } from './gondolConstants'

interface BuiltCard { name: string; label: string; color: string; width_cm: number }
interface BuiltCluster {
  cluster: string
  display_name: string
  color: string
  mult: number
  total_width: number
  cards: BuiltCard[]
}
type Layout = Record<ShelfKey, BuiltCluster[]>
type CardLoc = { shelf: ShelfKey; cluster: number; card: number }

const SHELF_TITLES: Record<ShelfKey, string> = {
  ust: 'Üst Raf', orta: 'Orta Raf', alt: 'Alt Raf',
}
const SHELF_ORDER: ShelfKey[] = ['ust', 'orta', 'alt']

function cloneLayout(layout: Layout): Layout {
  return {
    ust: layout.ust.map(c => ({ ...c, cards: [...c.cards] })),
    orta: layout.orta.map(c => ({ ...c, cards: [...c.cards] })),
    alt: layout.alt.map(c => ({ ...c, cards: [...c.cards] })),
  }
}

function buildLayout(products: GondolProduct[], selected: Set<number>): Layout {
  const byShelf: Record<ShelfKey, Map<string, BuiltCluster>> = { ust: new Map(), orta: new Map(), alt: new Map() }
  for (const p of products) {
    if (!selected.has(p.id)) continue
    const m = byShelf[p.shelf]
    let cl = m.get(p.clusterKey)
    if (!cl) {
      cl = {
        cluster: p.clusterKey, display_name: p.displayName, color: p.color,
        mult: CLUSTER_MULT[p.clusterKey] ?? 1, total_width: 0, cards: [],
      }
      m.set(p.clusterKey, cl)
    }
    cl.cards.push({ name: p.name, label: shortLabel(p.name), color: p.color, width_cm: p.width_cm })
  }
  const result = { ust: [], orta: [], alt: [] } as Layout
  for (const k of SHELF_ORDER) result[k] = recalcWidths([...byShelf[k].values()])
  return result
}

function moveCard(layout: Layout, src: CardLoc, target: CardLoc): Layout {
  const next = cloneLayout(layout)
  const srcArr = next[src.shelf][src.cluster].cards
  const [moved] = srcArr.splice(src.card, 1)
  let targetCard = target.card
  if (src.shelf === target.shelf && src.cluster === target.cluster && src.card < target.card) targetCard -= 1
  next[target.shelf][target.cluster].cards.splice(targetCard, 0, moved)
  for (const k of SHELF_ORDER) next[k] = recalcWidths(next[k])
  return next
}

function moveCardToShelf(layout: Layout, src: CardLoc, targetShelf: ShelfKey): Layout {
  const next = cloneLayout(layout)
  const srcMeta = layout[src.shelf][src.cluster]
  const srcArr = next[src.shelf][src.cluster].cards
  const [moved] = srcArr.splice(src.card, 1)
  let targetIdx = next[targetShelf].findIndex(c => c.cluster === srcMeta.cluster)
  if (targetIdx === -1) {
    next[targetShelf] = [...next[targetShelf], {
      cluster: srcMeta.cluster, display_name: srcMeta.display_name, color: srcMeta.color,
      mult: srcMeta.mult, total_width: 0, cards: [],
    }]
    targetIdx = next[targetShelf].length - 1
  }
  next[targetShelf][targetIdx].cards.push(moved)
  for (const k of SHELF_ORDER) next[k] = recalcWidths(next[k])
  return next
}

export default function ProductPlacement({ products }: { products: GondolProduct[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterText, setFilterText] = useState('')
  const [filterShelf, setFilterShelf] = useState<'ALL' | ShelfKey>('ALL')
  const [filterCluster, setFilterCluster] = useState<string>('ALL')
  const [layout, setLayout] = useState<Layout | null>(null)

  const dragRef = useRef<CardLoc | null>(null)
  const [dragOver, setDragOver] = useState<CardLoc | null>(null)
  const [dragOverShelf, setDragOverShelf] = useState<ShelfKey | null>(null)

  const clusterOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) m.set(p.clusterKey, p.displayName)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'tr'))
  }, [products])

  const filtered = products.filter(p =>
    (!filterText || p.name.toLowerCase().includes(filterText.toLowerCase()))
    && (filterShelf === 'ALL' || p.shelf === filterShelf)
    && (filterCluster === 'ALL' || p.clusterKey === filterCluster),
  )
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllFiltered() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(p => next.delete(p.id))
      else filtered.forEach(p => next.add(p.id))
      return next
    })
  }
  function clearSelection() {
    setSelected(new Set())
    setLayout(null)
  }

  function handleCardDrop(target: CardLoc) {
    const src = dragRef.current
    dragRef.current = null
    setDragOver(null)
    setDragOverShelf(null)
    if (!src || !layout) return
    if (src.shelf === target.shelf && src.cluster === target.cluster && src.card === target.card) return
    setLayout(prev => (prev ? moveCard(prev, src, target) : prev))
  }
  function handleShelfDrop(targetShelf: ShelfKey) {
    const src = dragRef.current
    dragRef.current = null
    setDragOver(null)
    setDragOverShelf(null)
    if (!src || !layout) return
    setLayout(prev => (prev ? moveCardToShelf(prev, src, targetShelf) : prev))
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">Ürün Seçimi ve Raf Yerleşimi</div>

      <div className="placement-filters">
        <input
          type="text"
          placeholder="Ürün adına göre ara…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="placement-input"
        />
        <select className="placement-select" value={filterShelf} onChange={e => setFilterShelf(e.target.value as 'ALL' | ShelfKey)}>
          <option value="ALL">Tüm raflar</option>
          <option value="ust">Üst Raf</option>
          <option value="orta">Orta Raf</option>
          <option value="alt">Alt Raf</option>
        </select>
        <select className="placement-select" value={filterCluster} onChange={e => setFilterCluster(e.target.value)}>
          <option value="ALL">Tüm kümeler</option>
          {clusterOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <div className="placement-toolbar">
        <button type="button" className="btn-reset-layout" onClick={toggleAllFiltered}>
          {allFilteredSelected ? 'Görünenlerin seçimini kaldır' : 'Görünenleri seç'} ({filtered.length})
        </button>
        <button type="button" className="btn-reset-layout" onClick={clearSelection} disabled={selected.size === 0}>
          Seçimi temizle
        </button>
        <span className="placement-count"><strong>{selected.size}</strong> ürün seçili</span>
        <button
          type="button"
          className="btn-build-layout"
          disabled={selected.size === 0}
          onClick={() => setLayout(buildLayout(products, selected))}
        >
          Yerleşim Oluştur
        </button>
      </div>

      <div className="placement-table-wrap">
        <table className="xlsx-table placement-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /></th>
              <th>Ürün Adı</th>
              <th>Küme</th>
              <th>Raf</th>
              <th>Genişlik (cm)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td>{p.name}</td>
                <td><span className="placement-cluster-tag" style={{ background: p.color }}>{p.displayName}</span></td>
                <td>{SHELF_TITLES[p.shelf]}</td>
                <td>{p.width_cm || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="xlsx-empty">Filtreye uyan ürün yok</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {layout && (
        <div className="placement-layout">
          <div className="section-label">
            Önizleme — seçilen ürünlerle oluşturulan raf düzeni
            <span className="drag-hint"> — ürünleri sürükleyip raflar arasında taşıyabilirsiniz</span>
          </div>
          <div className="cabinet">
            <div className="cabinet-meta-bar">
              <span className="cabinet-label">Manuel Yerleşim Önizlemesi</span>
              <span className="cabinet-roc">{SHELF_WIDTH_CM} cm / raf</span>
            </div>
            <div className="cabinet-shelves">
              {SHELF_ORDER.map(shelfKey => (
                <div className="shelf" key={shelfKey}>
                  <div className="shelf-bar">
                    <span className="shelf-name">{SHELF_TITLES[shelfKey]}</span>
                  </div>
                  <div
                    className={`shelf-body ${dragOverShelf === shelfKey ? 'drag-over-shelf' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverShelf(shelfKey) }}
                    onDragLeave={() => setDragOverShelf(null)}
                    onDrop={e => { e.preventDefault(); handleShelfDrop(shelfKey) }}
                  >
                    <div className="shelf-row">
                      {layout[shelfKey].length === 0 && (
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>Bu rafta ürün yok — buraya sürükleyin</span>
                      )}
                      {layout[shelfKey].map((cl, ci) => {
                        const last = ci === layout[shelfKey].length - 1
                        const sep: React.CSSProperties = last
                          ? {}
                          : { paddingRight: 6, marginRight: 5, borderRight: '1px solid var(--border)' }
                        return (
                          <div
                            key={cl.cluster + ci}
                            className="cluster-group"
                            style={{ flex: `${cl.total_width || 1} 0 0`, ...sep }}
                          >
                            <div className="cluster-lbl" style={{ background: cl.color }}>{cl.display_name}</div>
                            <div
                              className="cluster-cards"
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault(); e.stopPropagation()
                                handleCardDrop({ shelf: shelfKey, cluster: ci, card: cl.cards.length })
                              }}
                            >
                              {cl.cards.map((c, ji) => {
                                const loc: CardLoc = { shelf: shelfKey, cluster: ci, card: ji }
                                const isOver = !!dragOver
                                  && dragOver.shelf === loc.shelf && dragOver.cluster === loc.cluster && dragOver.card === loc.card
                                return (
                                  <div
                                    key={c.name + ji}
                                    className={`pcard ${isOver ? 'drag-over' : ''}`}
                                    title={c.name}
                                    draggable
                                    onDragStart={() => { dragRef.current = loc }}
                                    onDragEnd={() => { setDragOver(null); setDragOverShelf(null) }}
                                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(loc) }}
                                    onDragLeave={() => setDragOver(null)}
                                    onDrop={e => {
                                      e.preventDefault(); e.stopPropagation()
                                      handleCardDrop(loc)
                                    }}
                                  >
                                    <div className="pcard-body" style={{ background: c.color }}>{c.label}</div>
                                    <div className="pcard-foot" style={{ background: c.color }}>
                                      <div className="pcard-sales">{c.width_cm ? `${c.width_cm} cm` : '—'}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
