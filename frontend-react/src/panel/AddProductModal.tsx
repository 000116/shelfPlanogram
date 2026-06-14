import { useState } from 'react'
import type { ChocolateDraftProduct, ProductAddTarget } from '../types'
import type { GondolProduct, ShelfKey } from './gondolConstants'
import { CLUSTER_COLOR, DEFAULT_COLOR, SHELF_OF_CLUSTER } from './gondolConstants'
import {
  ALT_KATEGORI_BY_TARGET,
  URUN_TIPI_OPTIONS,
  YERLESIM_BY_TARGET,
  defaultAltKategori,
  defaultYerlesim,
  gondolAltKategoriForCluster,
  gondolClusterKeyForAltKategori,
} from './productAddOptions'

const SHELF_TITLES: Record<ShelfKey, string> = {
  ust: 'Üst Raf', orta: 'Orta Raf', alt: 'Alt Raf',
}

const TARGET_LABELS: Record<ProductAddTarget, string> = {
  gondol: 'Gondolbaşı',
  choco3: 'Çikolata Planogram Final · 3 Modül',
  choco2: 'Çikolata Planogram Final · 2 Modül',
}

const INITIAL_CLUSTER = gondolClusterKeyForAltKategori(defaultAltKategori('gondol'))

export default function AddProductModal({
  open, onClose,
  gondolProducts, onAddGondol, onRemoveGondol,
  chocolateProducts, onAddChocolate, onRemoveChocolate,
}: {
  open: boolean
  onClose: () => void
  gondolProducts: GondolProduct[]
  onAddGondol: (p: Omit<GondolProduct, 'id'>) => void
  onRemoveGondol: (id: number) => void
  chocolateProducts: ChocolateDraftProduct[]
  onAddChocolate: (p: Omit<ChocolateDraftProduct, 'id'>) => void
  onRemoveChocolate: (id: number) => void
}) {
  const [target, setTarget] = useState<ProductAddTarget>('gondol')
  const [sku, setSku] = useState('')
  const [marka, setMarka] = useState('')
  const [altKategori, setAltKategori] = useState(defaultAltKategori('gondol'))
  const [clusterKey, setClusterKey] = useState(INITIAL_CLUSTER)
  const [widthCm, setWidthCm] = useState('')
  const [score, setScore] = useState('')
  const [yerlesim, setYerlesim] = useState(defaultYerlesim('choco3'))
  const [urunTipi, setUrunTipi] = useState<string>(URUN_TIPI_OPTIONS[0])
  const [sales, setSales] = useState('')

  if (!open) return null

  function applyTargetDefaults(next: ProductAddTarget) {
    setTarget(next)
    const nextAlt = defaultAltKategori(next)
    setAltKategori(nextAlt)
    if (next === 'gondol') {
      setClusterKey(gondolClusterKeyForAltKategori(nextAlt))
    } else {
      setYerlesim(defaultYerlesim(next))
      setUrunTipi(URUN_TIPI_OPTIONS[0])
    }
  }

  function handleGondolAltKategoriChange(label: string) {
    setAltKategori(label)
    setClusterKey(gondolClusterKeyForAltKategori(label))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = sku.trim()
    if (!trimmed) return
    if (target === 'gondol') {
      if (!clusterKey) return
      onAddGondol({
        name: trimmed,
        clusterKey,
        displayName: gondolAltKategoriForCluster(clusterKey),
        color: CLUSTER_COLOR[clusterKey] ?? DEFAULT_COLOR,
        shelf: SHELF_OF_CLUSTER[clusterKey] ?? 'ust',
        width_cm: Number(widthCm) || 0,
        sales: Number(sales) || 0,
      })
    } else {
      if (!altKategori || !yerlesim || !urunTipi) return
      onAddChocolate({
        target,
        sku: trimmed,
        marka: marka.trim(),
        altKategori,
        genislikCm: Number(widthCm) || 0,
        tahminiSkor: Number(score) || 0,
        yerlesim,
        urunTipi,
      })
    }
    setSku('')
    setMarka('')
    setAltKategori(defaultAltKategori(target))
    setClusterKey(gondolClusterKeyForAltKategori(defaultAltKategori('gondol')))
    setWidthCm('')
    setScore('')
    setYerlesim(target === 'gondol' ? defaultYerlesim('choco3') : defaultYerlesim(target))
    setUrunTipi(URUN_TIPI_OPTIONS[0])
    setSales('')
  }

  const altKategoriOptions = ALT_KATEGORI_BY_TARGET[target]
  const yerlesimOptions = target !== 'gondol' ? YERLESIM_BY_TARGET[target] : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="card-title" style={{ marginBottom: 0 }}>Ürün Ekle</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <p className="modal-hint">
          Ürün eklenecek rafı seçin. Alt kategori, yerleşim ve ürün tipi seçilen rafa göre listelenir.
        </p>

        <form className="placement-filters" onSubmit={handleSubmit}>
          <select
            className="placement-select"
            value={target}
            onChange={e => applyTargetDefaults(e.target.value as ProductAddTarget)}
            style={{ flex: '1 1 260px' }}
            aria-label="Ürün eklenecek raf"
          >
            <option value="gondol">Ürün eklenecek raf: Gondolbaşı</option>
            <option value="choco3">Ürün eklenecek raf: Çikolata Planogram Final · 3 Modül</option>
            <option value="choco2">Ürün eklenecek raf: Çikolata Planogram Final · 2 Modül</option>
          </select>
          <input
            type="text"
            placeholder="SKU"
            value={sku}
            onChange={e => setSku(e.target.value)}
            className="placement-input"
            required
          />
          {target === 'gondol' ? (
            <select
              className="placement-select"
              value={altKategori}
              onChange={e => handleGondolAltKategoriChange(e.target.value)}
              aria-label="Alt kategori"
              required
            >
              {altKategoriOptions.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="text"
                placeholder="Marka"
                value={marka}
                onChange={e => setMarka(e.target.value)}
                className="placement-input"
                required
              />
              <select
                className="placement-select"
                value={altKategori}
                onChange={e => setAltKategori(e.target.value)}
                aria-label="Alt kategori"
                required
              >
                {altKategoriOptions.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </>
          )}
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Genişlik (cm)"
            value={widthCm}
            onChange={e => setWidthCm(e.target.value)}
            className="placement-input"
            required
            style={{ flex: '0 0 140px', minWidth: 0 }}
          />
          {target === 'gondol' ? (
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Satış (adet)"
              value={sales}
              onChange={e => setSales(e.target.value)}
              className="placement-input"
              style={{ flex: '0 0 140px', minWidth: 0 }}
            />
          ) : (
            <>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Tahmini skor"
                value={score}
                onChange={e => setScore(e.target.value)}
                className="placement-input"
                required
                style={{ flex: '0 0 140px', minWidth: 0 }}
              />
              <select
                className="placement-select"
                value={yerlesim}
                onChange={e => setYerlesim(e.target.value)}
                aria-label="Yerleşim"
                required
              >
                {yerlesimOptions.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
              <select
                className="placement-select"
                value={urunTipi}
                onChange={e => setUrunTipi(e.target.value)}
                aria-label="Ürün tipi"
                required
              >
                {URUN_TIPI_OPTIONS.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </>
          )}
          <button type="submit" className="btn-build-layout">Ekle</button>
        </form>

        {gondolProducts.length > 0 && (
          <div className="placement-table-wrap modal-table-wrap">
            <table className="xlsx-table placement-table">
              <thead>
                <tr>
                  <th>Ürün Adı</th>
                  <th>Alt Kategori</th>
                  <th>Raf</th>
                  <th>Genişlik (cm)</th>
                  <th>Satış</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gondolProducts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="placement-cluster-tag" style={{ background: p.color }}>{p.displayName}</span></td>
                    <td>{SHELF_TITLES[p.shelf]}</td>
                    <td>{p.width_cm || '—'}</td>
                    <td>{p.sales || '—'}</td>
                    <td>
                      <button type="button" className="btn-reset-layout" onClick={() => onRemoveGondol(p.id)}>Kaldır</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {chocolateProducts.length > 0 && (
          <div className="placement-table-wrap modal-table-wrap">
            <table className="xlsx-table placement-table">
              <thead>
                <tr>
                  <th>Raf</th>
                  <th>SKU</th>
                  <th>Marka</th>
                  <th>Alt Kategori</th>
                  <th>Genişlik</th>
                  <th>Skor</th>
                  <th>Yerleşim</th>
                  <th>Ürün Tipi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chocolateProducts.map(p => (
                  <tr key={p.id}>
                    <td>{TARGET_LABELS[p.target]}</td>
                    <td>{p.sku}</td>
                    <td>{p.marka}</td>
                    <td>{p.altKategori}</td>
                    <td>{p.genislikCm || '—'}</td>
                    <td>{p.tahminiSkor || '—'}</td>
                    <td>{p.yerlesim}</td>
                    <td>{p.urunTipi}</td>
                    <td>
                      <button type="button" className="btn-reset-layout" onClick={() => onRemoveChocolate(p.id)}>Kaldır</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
