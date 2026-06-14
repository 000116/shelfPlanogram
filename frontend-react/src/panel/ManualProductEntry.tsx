import { useState } from 'react'
import type { GondolProduct, ShelfKey } from './gondolConstants'
import { CLUSTER_DISPLAY, CLUSTER_COLOR, SHELF_OF_CLUSTER, DEFAULT_COLOR } from './gondolConstants'

const SHELF_TITLES: Record<ShelfKey, string> = {
  ust: 'Üst Raf', orta: 'Orta Raf', alt: 'Alt Raf',
}

const CLUSTER_OPTIONS = Object.entries(CLUSTER_DISPLAY)
  .sort((a, b) => a[1].localeCompare(b[1], 'tr'))

export default function ManualProductEntry({
  products, onAdd, onRemove,
}: {
  products: GondolProduct[]
  onAdd: (p: Omit<GondolProduct, 'id'>) => void
  onRemove: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [clusterKey, setClusterKey] = useState(CLUSTER_OPTIONS[0]?.[0] ?? '')
  const [widthCm, setWidthCm] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !clusterKey) return
    onAdd({
      name: trimmed,
      clusterKey,
      displayName: CLUSTER_DISPLAY[clusterKey] ?? clusterKey,
      color: CLUSTER_COLOR[clusterKey] ?? DEFAULT_COLOR,
      shelf: SHELF_OF_CLUSTER[clusterKey] ?? 'ust',
      width_cm: Number(widthCm) || 0,
    })
    setName('')
    setWidthCm('')
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">Ürün Ekle</div>
      <form className="placement-filters" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ürün adı"
          value={name}
          onChange={e => setName(e.target.value)}
          className="placement-input"
          required
        />
        <select
          className="placement-select"
          value={clusterKey}
          onChange={e => setClusterKey(e.target.value)}
        >
          {CLUSTER_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input
          type="number"
          step="0.1"
          min="0"
          placeholder="Genişlik (cm)"
          value={widthCm}
          onChange={e => setWidthCm(e.target.value)}
          className="placement-input"
          style={{ flex: '0 0 140px', minWidth: 0 }}
        />
        <button type="submit" className="btn-build-layout">Ekle</button>
      </form>

      {products.length > 0 && (
        <div className="placement-table-wrap" style={{ marginTop: 10 }}>
          <table className="xlsx-table placement-table">
            <thead>
              <tr>
                <th>Ürün Adı</th>
                <th>Küme</th>
                <th>Raf</th>
                <th>Genişlik (cm)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className="placement-cluster-tag" style={{ background: p.color }}>{p.displayName}</span></td>
                  <td>{SHELF_TITLES[p.shelf]}</td>
                  <td>{p.width_cm || '—'}</td>
                  <td>
                    <button type="button" className="btn-reset-layout" onClick={() => onRemove(p.id)}>Kaldır</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
