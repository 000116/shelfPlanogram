import { useRef, useState } from 'react'
import type { ChocoData, ChocoShelf, Weights } from '../types'
import { fmt } from '../util'

const WL: Record<string, string> = {
  satis: 'Satış Payı', birim_kar: 'Net Kâr Payı', c2: 'C2 Payı',
  ciro_pay: 'Ciro Payı', niel_gas: 'Nielsen GasSt', niel_spm: 'Nielsen SPM',
  deli2go: 'Yeni Ürün / Deli2go',
}

type CardLoc = { shelfIdx: number; cardIdx: number }

export default function ChocolateView({
  data, shelf, weights, onWeightChange,
}: {
  data: ChocoData | null
  shelf: string
  weights: Weights
  onWeightChange: (key: string, value: number) => void
}) {
  const [shelvesState, setShelvesState] = useState<ChocoShelf[]>(() => (data ? structuredClone(data.shelves) : []))
  const [edited, setEdited] = useState(false)
  const [prevData, setPrevData] = useState(data)
  const dragRef = useRef<CardLoc | null>(null)
  const [dragOver, setDragOver] = useState<CardLoc | null>(null)

  if (data !== prevData) {
    setPrevData(data)
    setShelvesState(data ? structuredClone(data.shelves) : [])
    setEdited(false)
  }

  function handleDrop(target: CardLoc) {
    const src = dragRef.current
    dragRef.current = null
    if (!src) return
    if (src.shelfIdx === target.shelfIdx && src.cardIdx === target.cardIdx) return
    let moved = false
    setShelvesState(prev => {
      const next = prev.map(s => ({ ...s, cards: [...s.cards] }))
      const a = next[src.shelfIdx].cards[src.cardIdx]
      const b = next[target.shelfIdx].cards[target.cardIdx]
      if (a.locked || b.locked) return prev
      next[src.shelfIdx].cards[src.cardIdx] = b
      next[target.shelfIdx].cards[target.cardIdx] = a
      moved = true
      return next
    })
    if (moved) setEdited(true)
  }

  function resetLayout() {
    setShelvesState(data ? structuredClone(data.shelves) : [])
    setEdited(false)
  }

  const want = shelf && shelf !== 'ALL' ? Number(shelf.replace('R', '')) : null
  const shelvesWithIdx = shelvesState.map((s, idx) => ({ s, idx }))
  const shelves = shelvesWithIdx.filter(({ s }) => want === null || s.raf === want)
  const mxTop = data?.top.length ? data.top[0].score : 1

  const total = Math.round(Object.values(weights).reduce((a, b) => a + (b || 0), 0) * 100) / 100
  const totalColor = total === 1.0 ? '#1e7e34' : 'var(--red)'

  return (
    <div className="panel-choco">
      <div className="page-top"><div>
        <div className="page-title">{data?.title ?? 'Çikolata Planogram Final'}</div>
        <div className="page-sub">
          {data ? `${data.kpis.sku_count} SKU · raf genişliği ${data.shelf_width_cm} cm · üst raf en yüksek öncelik` : '—'}
        </div>
      </div></div>

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">SKU</div><div className="kpi-val">{fmt(data?.kpis.sku_count)}</div></div>
        <div className="kpi"><div className="kpi-label">Toplam Facing</div><div className="kpi-val">{fmt(data?.kpis.total_facing)}</div></div>
        <div className="kpi"><div className="kpi-label">Kilitli (alt raf)</div><div className="kpi-val">{fmt(data?.kpis.locked)}</div></div>
        <div className="kpi"><div className="kpi-label">Toplam Satış</div><div className="kpi-val">{fmt(data?.kpis.total_sales)}</div></div>
      </div>

      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Çikolata Planogram Final — raf önceliği 1 → 3 → 2 → 4 → 5 <span className="drag-hint">— ürünleri sürükleyip yer değiştirebilirsiniz</span></span>
        {edited && (
          <button type="button" className="btn-reset-layout" onClick={resetLayout}>
            Düzeni Sıfırla
          </button>
        )}
      </div>
      <div className="cabinet">
        <div className="cabinet-meta-bar">
          <span className="cabinet-label">{data?.title ?? 'Çikolata Gondolu'}</span>
          <span className="cabinet-roc">{data ? `${data.shelf_width_cm} cm / raf` : '—'}</span>
        </div>
        <div className="cabinet-shelves" id="planogram-shelves-export">
          {shelves.map(({ s, idx: shelfIdx }) => (
            <div className="choco-shelf" key={s.raf}>
              <div className="choco-shelf-bar">
                <span>RAF {s.raf} <span className="meta">
                  çarpan {s.mult} · öncelik #{s.priority_rank}
                  {s.package_only ? ' · sadece paket ürün' : ''}
                  {s.raf === 5 && data?.module === '3' ? ' · kilitli' : ''}
                </span></span>
                <span className="meta">{s.used_cm}/{s.cap_cm} cm · {s.used_facing ?? 0} yüz · {s.cards.length} SKU</span>
              </div>
              <div className="choco-row">
                {s.cards.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                {s.cards.map((c, i) => {
                  const loc: CardLoc = { shelfIdx, cardIdx: i }
                  const isOver = !!dragOver && dragOver.shelfIdx === loc.shelfIdx && dragOver.cardIdx === loc.cardIdx
                  return (
                  <div
                    key={c.name + i}
                    className={`ccard ${c.locked ? 'locked' : ''} ${isOver ? 'drag-over' : ''}`}
                    title={`${c.name} · skor ${c.score} · ${c.facing} yüz`}
                    draggable={!c.locked}
                    onDragStart={e => {
                      if (c.locked) {
                        e.preventDefault()
                        dragRef.current = null
                        return
                      }
                      dragRef.current = loc
                    }}
                    onDragEnd={() => setDragOver(null)}
                    onDragOver={e => {
                      if (c.locked) return
                      e.preventDefault()
                      setDragOver(loc)
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); setDragOver(null); handleDrop(loc) }}
                    style={{
                      flex: `${c.unit_w} 0 0`, background: c.color, display: 'flex',
                      flexDirection: 'column', justifyContent: 'space-between', borderRadius: 6,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.12)',
                      padding: 6, position: 'relative',
                    }}
                  >
                    <div className="ccard-lbl" style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.1, maxHeight: 22, overflow: 'hidden', marginBottom: 4, textShadow: '0 1px 2px rgba(0,0,0,0.4)', textOverflow: 'ellipsis', color: '#fff' }}>
                      {c.label}
                    </div>
                    <div className="ccard-chocolates" style={{ display: 'flex', gap: 3, flexGrow: 1, alignItems: 'stretch', margin: '4px 0', minHeight: 36 }}>
                      {Array.from({ length: c.facing }).map((_, k) => (
                        <div key={k} style={{ flex: 1, background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)', pointerEvents: 'none' }} />
                        </div>
                      ))}
                    </div>
                    <div className="ccard-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 3 }}>
                      <span className="ccard-fac" style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 3, padding: '1px 4px', fontWeight: 800, fontSize: 8.5 }}>{c.facing}x</span>
                      <span style={{ fontWeight: 600, opacity: 0.9, textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}>Skor: {c.score}</span>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bottom-grid">
        <div className="card">
          <div className="card-title">En yüksek skorlu 10</div>
          <div>
            {data?.top.map((p, i) => (
              <div className="tp" key={i}>
                <span className={`tp-n ${i < 3 ? 'g' : ''}`}>{i + 1}</span>
                <span className="tp-name" title={p.label}>{p.label}</span>
                <div className="tp-bar"><div className="tp-bar-f" style={{ width: `${(p.score / mxTop * 100).toFixed(0)}%` }} /></div>
                <span className="tp-v">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Skor Ağırlıkları</span>
            <span style={{ fontSize: 11, fontWeight: 500 }}>
              Toplam: <span style={{ fontWeight: 700, color: totalColor }}>{Math.round(total * 100)}%</span>
            </span>
          </div>
          <div style={{ paddingTop: 10 }}>
            {Object.keys(WL).map(k => (
              <div className="ch-w" key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span>{WL[k]}</span>
                <input
                  type="number"
                  data-key={k}
                  value={weights[k] ?? 0}
                  step="0.05"
                  min="0"
                  max="1"
                  style={{ width: 70, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right' }}
                  onChange={e => onWeightChange(k, parseFloat(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
