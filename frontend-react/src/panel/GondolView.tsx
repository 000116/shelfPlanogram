import { useRef, useState } from 'react'
import type { PlanogramData, GondolCluster } from '../types'
import type { GondolProduct, ShelfKey } from '../panel/gondolConstants'
import { recalcWidths } from '../panel/gondolConstants'
import { fmt, pct } from '../util'

type CardLoc = { shelf: ShelfKey; cluster: number; card: number }

function cloneShelves(data: PlanogramData | null): Record<ShelfKey, GondolCluster[]> {
  const base: Record<ShelfKey, GondolCluster[]> = {
    ust: data ? structuredClone(data.ust_shelf) : [],
    orta: data ? structuredClone(data.orta_shelf) : [],
    alt: data ? structuredClone(data.alt_shelf) : [],
  }
  base.ust = recalcWidths(base.ust)
  base.orta = recalcWidths(base.orta)
  base.alt = recalcWidths(base.alt)
  return base
}

function ShelfRow({
  shelfKey, clusters, dragRef, onDrop, dragOver, setDragOver,
}: {
  shelfKey: ShelfKey
  clusters?: GondolCluster[]
  dragRef: React.RefObject<CardLoc | null>
  onDrop: (target: CardLoc) => void
  dragOver: CardLoc | null
  setDragOver: (loc: CardLoc | null) => void
}) {
  if (!clusters?.length) {
    return <span style={{ color: 'var(--muted)', fontSize: 11 }}>Veri yok</span>
  }
  return (
    <>
      {clusters.map((cl, ci) => {
        const last = ci === clusters.length - 1
        const sep: React.CSSProperties = last
          ? {}
          : { paddingRight: 6, marginRight: 5, borderRight: '1px solid var(--border)' }
        return (
          <div
            key={cl.cluster + ci}
            className="cluster-group"
            style={{ flex: `${cl.total_width} 0 0`, ...sep }}
          >
            <div className="cluster-lbl" style={{ background: cl.color }}>{cl.display_name}</div>
            <div className="cluster-cards">
              {cl.cards.map((c, ji) => {
                const loc: CardLoc = { shelf: shelfKey, cluster: ci, card: ji }
                const isOver = !!dragOver
                  && dragOver.shelf === loc.shelf && dragOver.cluster === loc.cluster && dragOver.card === loc.card
                return (
                  <div
                    key={c.name + ji}
                    className={`pcard ${c.sales === 0 ? 'pcard-zero' : ''} ${isOver ? 'drag-over' : ''}`}
                    title={c.name}
                    draggable
                    onDragStart={() => { dragRef.current = loc }}
                    onDragEnd={() => setDragOver(null)}
                    onDragOver={e => { e.preventDefault(); setDragOver(loc) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); setDragOver(null); onDrop(loc) }}
                  >
                    <div className="pcard-body" style={{ background: c.is_custom ? '#2e7d32' : c.color }}>
                      {c.label}
                      {c.is_custom && (
                        <span style={{ fontSize: '8px', fontWeight: 'bold', display: 'block', color: '#fff', marginTop: '4px' }}>
                          (YENİ)
                        </span>
                      )}
                    </div>
                    <div className="pcard-foot" style={{ background: c.is_custom ? '#1b5e20' : c.color }}>
                      <div className="pcard-sales">{fmt(c.sales)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function GondolView({ data, shelf, extraProducts }: {
  data: PlanogramData | null; shelf: string; extraProducts: GondolProduct[]
}) {
  const tot = data?.total_sales || 1
  const showUst = shelf === 'ALL' || shelf === 'UST'
  const showOrta = shelf === 'ALL' || shelf === 'ORTA'
  const showAlt = shelf === 'ALL' || shelf === 'ALT'

  const [shelves, setShelves] = useState<Record<ShelfKey, GondolCluster[]>>(() => cloneShelves(data))
  const [edited, setEdited] = useState(false)
  const [prevData, setPrevData] = useState(data)
  const [prevExtras, setPrevExtras] = useState(extraProducts)
  const dragRef = useRef<CardLoc | null>(null)
  const [dragOver, setDragOver] = useState<CardLoc | null>(null)

  if (data !== prevData || extraProducts !== prevExtras) {
    setPrevData(data)
    setPrevExtras(extraProducts)
    setShelves(cloneShelves(data))
    setEdited(false)
  }

  function handleDrop(target: CardLoc) {
    const src = dragRef.current
    dragRef.current = null
    if (!src) return
    if (src.shelf === target.shelf && src.cluster === target.cluster && src.card === target.card) return
    setShelves(prev => {
      const next: Record<ShelfKey, GondolCluster[]> = {
        ust: prev.ust.map(c => ({ ...c, cards: [...c.cards] })),
        orta: prev.orta.map(c => ({ ...c, cards: [...c.cards] })),
        alt: prev.alt.map(c => ({ ...c, cards: [...c.cards] })),
      }
      const a = next[src.shelf][src.cluster].cards[src.card]
      const b = next[target.shelf][target.cluster].cards[target.card]
      next[src.shelf][src.cluster].cards[src.card] = b
      next[target.shelf][target.cluster].cards[target.card] = a
      return next
    })
    setEdited(true)
  }

  function resetLayout() {
    setShelves(cloneShelves(data))
    setEdited(false)
  }

  const cats = data ? [
    { name: 'Health', val: data.cat_totals.HEALTH, c: 'var(--red)' },
    { name: 'NAB', val: data.cat_totals.NAB, c: '#1a56b0' },
    { name: 'Sandwiches', val: data.cat_totals.SANDWICHES, c: '#1e7e34' },
  ] : []
  const mxTop = data?.top_products.length ? data.top_products[0].sales : 1

  return (
    <div className="panel-main">
      <div className="page-top">
        <div>
          <div className="page-title">{data?.station ?? '—'}</div>
          <div className="page-sub">
            {data ? `${data.quarter_info.label} · ${data.quarter_info.months} · 2025` : '—'}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Toplam Satış</div>
          <div className="kpi-val">{fmt(data?.total_sales)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Health</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{fmt(data?.cat_totals.HEALTH)}</div>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ background: 'var(--red)', width: data ? pct(data.cat_totals.HEALTH, tot) : 0 }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">NAB</div>
          <div className="kpi-val" style={{ color: '#1a56b0' }}>{fmt(data?.cat_totals.NAB)}</div>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ background: '#1a56b0', width: data ? pct(data.cat_totals.NAB, tot) : 0 }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sandwiches</div>
          <div className="kpi-val" style={{ color: '#1e7e34' }}>{fmt(data?.cat_totals.SANDWICHES)}</div>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ background: '#1e7e34', width: data ? pct(data.cat_totals.SANDWICHES, tot) : 0 }} /></div>
        </div>
      </div>

      <div id="planogram-export">
        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Planogram <span className="drag-hint">— ürünleri sürükleyip yer değiştirebilirsiniz</span></span>
          {edited && (
            <button type="button" className="btn-reset-layout" onClick={resetLayout}>
              Düzeni Sıfırla
            </button>
          )}
        </div>
        <div className="cabinet">
          <div className="cabinet-meta-bar">
            <span className="cabinet-label">Gondolbaşı Dolabı</span>
            <span className="cabinet-roc">{data ? `ROC ${data.roc} · ${data.quarter_info.label}` : '—'}</span>
          </div>
          <div className="cabinet-shelves" id="planogram-shelves-export">
            {showUst && (
              <div className="shelf">
                <div className="shelf-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="shelf-name">Üst Raf</span>
                    <span className="shelf-desc">İçecek &amp; Sağlık</span>
                  </div>
                  {data?.shelf_widths?.ust && (
                    <span className="shelf-capacity" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sub)' }}>
                      {data.shelf_widths.ust.used_cm.toFixed(1)} / {data.shelf_widths.ust.max_cm.toFixed(1)} cm (%{data.shelf_widths.ust.pct.toFixed(1)})
                    </span>
                  )}
                </div>
                <div className="shelf-body"><div className="shelf-row">
                  <ShelfRow shelfKey="ust" clusters={shelves.ust} dragRef={dragRef} onDrop={handleDrop} dragOver={dragOver} setDragOver={setDragOver} />
                </div></div>
              </div>
            )}
            {showOrta && (
              <div className="shelf">
                <div className="shelf-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="shelf-name">Orta Raf</span>
                    <span className="shelf-desc">Sıcak Yiyecek &amp; 3rd Party</span>
                  </div>
                  {data?.shelf_widths?.orta && (
                    <span className="shelf-capacity" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sub)' }}>
                      {data.shelf_widths.orta.used_cm.toFixed(1)} / {data.shelf_widths.orta.max_cm.toFixed(1)} cm (%{data.shelf_widths.orta.pct.toFixed(1)})
                    </span>
                  )}
                </div>
                <div className="shelf-body"><div className="shelf-row">
                  <ShelfRow shelfKey="orta" clusters={shelves.orta} dragRef={dragRef} onDrop={handleDrop} dragOver={dragOver} setDragOver={setDragOver} />
                </div></div>
              </div>
            )}
            {showAlt && (
              <div className="shelf">
                <div className="shelf-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="shelf-name">Alt Raf</span>
                    <span className="shelf-desc">Sandviç &amp; Diğer</span>
                  </div>
                  {data?.shelf_widths?.alt && (
                    <span className="shelf-capacity" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sub)' }}>
                      {data.shelf_widths.alt.used_cm.toFixed(1)} / {data.shelf_widths.alt.max_cm.toFixed(1)} cm (%{data.shelf_widths.alt.pct.toFixed(1)})
                    </span>
                  )}
                </div>
                <div className="shelf-body"><div className="shelf-row">
                  <ShelfRow shelfKey="alt" clusters={shelves.alt} dragRef={dragRef} onDrop={handleDrop} dragOver={dragOver} setDragOver={setDragOver} />
                </div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="card">
          <div className="card-title">Top 10 Ürün</div>
          <div>
            {data?.top_products.map((p, i) => (
              <div className="tp" key={i}>
                <span className={`tp-n ${i < 3 ? 'g' : ''}`}>{i + 1}</span>
                <span className="tp-name" title={p.label}>{p.label}</span>
                <div className="tp-bar"><div className="tp-bar-f" style={{ width: `${(p.sales / mxTop * 100).toFixed(0)}%` }} /></div>
                <span className="tp-v">{fmt(p.sales)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Kategori</div>
          <div>
            {cats.map((cat, i) => (
              <div className="cat" key={i}>
                <div className="cat-row">
                  <div className="cat-dot" style={{ background: cat.c }} />
                  <div className="cat-name">{cat.name}</div>
                  <div className="cat-val">{fmt(cat.val)}</div>
                  <div className="cat-pct">{pct(cat.val, tot)}</div>
                </div>
                <div className="cat-bar"><div className="cat-bar-f" style={{ background: cat.c, width: pct(cat.val, tot) }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
