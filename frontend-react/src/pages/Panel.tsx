import { useCallback, useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import type {
  MeContext, PlanogramData, ChocoData, ChocoSku, Weights, ChocolateDraftProduct,
  CustomProductRecord,
} from '../types'
import {
  getPlanogram, getChocolateSkus, allocateChocolate, logout as apiLogout, AuthError,
  getCustomProducts, createCustomProduct, deleteCustomProduct,
} from '../api'
import { STATIC } from '../util'
import type { GondolProduct } from '../panel/gondolConstants'
import GondolView from '../panel/GondolView'
import ChocolateView from '../panel/ChocolateView'
import RightDrawer from '../panel/RightDrawer'
import AddProductModal from '../panel/AddProductModal'

const CHOCO_MODULE: Record<string, string> = { CHOCO3: '3', CHOCO2: '2' }
const isChoco = (z: string) => z === 'CHOCO3' || z === 'CHOCO2'

export default function Panel({ ctx, initialRoc, onLogout, onHome }: {
  ctx: MeContext; initialRoc?: number; onLogout: () => void; onHome?: () => void
}) {
  const [zone, setZone] = useState('GONDOL')
  const [shelf, setShelf] = useState('ALL')
  const [roc, setRoc] = useState(initialRoc ?? ctx.default_roc)
  const [quarter, setQuarter] = useState('Q1')

  const [planogram, setPlanogram] = useState<PlanogramData | null>(null)
  const [choco, setChoco] = useState<ChocoData | null>(null)
  const [drawerSKUs, setDrawerSKUs] = useState<ChocoSku[]>([])
  const [weights, setWeights] = useState<Weights | null>(null)
  const [auto, setAuto] = useState(true)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [gondolExtraProducts, setGondolExtraProducts] = useState<GondolProduct[]>([])
  const [chocolateDraftProducts, setChocolateDraftProducts] = useState<ChocolateDraftProduct[]>([])

  const selectedRef = useRef<Set<string>>(new Set())

  const handleAuth = useCallback((e: unknown) => {
    if (e instanceof AuthError) { onLogout(); return true }
    return false
  }, [onLogout])

  const fetchPlanogram = useCallback(async (r: number, q: string, selectedArr?: string[]) => {
    setBusy(true)
    try {
      const d = await getPlanogram(r, q, selectedArr)
      if (d.error) { alert(d.error); return }
      setPlanogram(d)
      if (d.skus) {
        setDrawerSKUs(d.skus)
        selectedRef.current = new Set(d.skus.filter(s => s.selected).map(s => s.name))
      }
    } catch (e) { if (!handleAuth(e)) console.error(e) }
    finally { setBusy(false) }
  }, [handleAuth])

  const runAllocate = useCallback(async (o: {
    module: string; selectedArr: string[]; auto: boolean; weights: Weights | null;
    roc: number; quarter: string
  }) => {
    setBusy(true)
    try {
      const d = await allocateChocolate({
        module: o.module, selected: o.selectedArr, weights: o.weights,
        auto: o.auto,
        roc: o.roc, quarter: o.quarter,
      })
      if (d.error) { alert(d.error); return }
      if (d.skus) {
        setDrawerSKUs(d.skus)
        selectedRef.current = new Set(d.skus.filter(s => s.selected).map(s => s.name))
      }
      if (d.weights) setWeights(d.weights)
      setChoco(d)
    } catch (e) { if (!handleAuth(e)) console.error(e) }
    finally { setBusy(false) }
  }, [handleAuth])

  const initChocolateZone = useCallback(async (
    module: string, targetRoc: number, targetQuarter: string,
  ) => {
    setAuto(true)
    setSearch('')
    setBusy(true)
    try {
      const skus = await getChocolateSkus(module, weights, targetRoc, targetQuarter)
      const sel = new Set(skus.filter(s => s.locked).map(s => s.name))
      selectedRef.current = sel
      setDrawerSKUs(skus)
      await runAllocate({
        module, selectedArr: [...sel], auto: true, weights,
        roc: targetRoc, quarter: targetQuarter,
      })
    } catch (e) { if (!handleAuth(e)) console.error(e) }
    finally { setBusy(false) }
  }, [weights, runAllocate, handleAuth])

  function applyCustomProducts(items: CustomProductRecord[]) {
    setGondolExtraProducts(items
      .filter(item => item.target === 'gondol')
      .map(item => ({
        id: item.id,
        name: item.sku,
        clusterKey: item.cluster_key || 'Diger',
        displayName: item.display_name || item.cluster_key || 'Diğer',
        color: item.color || '#607d8b',
        shelf: (item.shelf || 'ust') as GondolProduct['shelf'],
        width_cm: item.width_cm || 0,
        sales: item.sales || 0,
      })))
    setChocolateDraftProducts(items
      .filter(item => item.target === 'choco3' || item.target === 'choco2')
      .map(item => ({
        id: item.id,
        target: item.target as ChocolateDraftProduct['target'],
        sku: item.sku,
        marka: item.marka || '',
        altKategori: item.alt_kategori || '',
        genislikCm: item.width_cm || 0,
        tahminiSkor: item.tahmini_skor || 0,
        yerlesim: item.yerlesim || '',
        urunTipi: item.urun_tipi || '',
      })))
  }

  const loadCustomProducts = useCallback(async () => {
    try {
      applyCustomProducts(await getCustomProducts())
    } catch (e) { if (!handleAuth(e)) console.error(e) }
  }, [handleAuth])

  useEffect(() => { fetchPlanogram(ctx.default_roc, 'Q1') }, [fetchPlanogram, ctx.default_roc])
  useEffect(() => { loadCustomProducts() }, [loadCustomProducts])

  function selectFixture(z: string, sh: string) {
    const zoneChanged = zone !== z
    setZone(z)
    setShelf(sh)
    if (z !== 'GONDOL' && !isChoco(z)) setDrawerOpen(false)
    if (z === 'GONDOL') fetchPlanogram(roc, quarter)
    else if (isChoco(z)) {
      const module = CHOCO_MODULE[z]
      if (zoneChanged) initChocolateZone(module, roc, quarter)
      else runAllocate({
        module, selectedArr: [...selectedRef.current], auto, weights, roc, quarter,
      })
    }
  }

  function selectStation(r: number) {
    setRoc(r)
    if (zone === 'GONDOL') fetchPlanogram(r, quarter)
    else if (isChoco(zone)) runAllocate({
      module: CHOCO_MODULE[zone], selectedArr: [...selectedRef.current],
      auto, weights, roc: r, quarter,
    })
  }
  function selectQuarter(q: string) {
    setQuarter(q)
    if (zone === 'GONDOL') fetchPlanogram(roc, q)
    else if (isChoco(zone)) runAllocate({
      module: CHOCO_MODULE[zone], selectedArr: [...selectedRef.current],
      auto, weights, roc, quarter: q,
    })
  }

  const module = CHOCO_MODULE[zone] || '3'

  function toggleSku(name: string, checked: boolean) {
    setAuto(false)
    const sel = new Set(selectedRef.current)
    if (checked) sel.add(name); else sel.delete(name)
    selectedRef.current = sel
    if (zone === 'GONDOL') {
      fetchPlanogram(roc, quarter, [...sel])
    } else {
      runAllocate({ module, selectedArr: [...sel], auto: false, weights, roc, quarter })
    }
  }
  function selectAllSKUs() {
    setAuto(true)
    selectedRef.current = new Set()
    if (zone === 'GONDOL') {
      fetchPlanogram(roc, quarter, undefined)
    } else {
      runAllocate({ module, selectedArr: [], auto: true, weights, roc, quarter })
    }
  }
  function clearAllSKUs() {
    setAuto(false)
    const sel = new Set<string>()
    selectedRef.current = sel
    if (zone === 'GONDOL') {
      fetchPlanogram(roc, quarter, [...sel])
    } else {
      runAllocate({ module, selectedArr: [...sel], auto: false, weights, roc, quarter })
    }
  }
  function toggleAutoRecommend() {
    const next = !auto
    setAuto(next)
    if (zone === 'GONDOL') {
      fetchPlanogram(roc, quarter, next ? undefined : [...selectedRef.current])
    } else {
      runAllocate({
        module, selectedArr: [...selectedRef.current], auto: next, weights, roc, quarter,
      })
    }
  }
  function onWeightChange(key: string, val: number) {
    const nw: Weights = { ...(weights ?? choco?.weights ?? {}), [key]: val }
    setWeights(nw)
    const total = Math.round(Object.values(nw).reduce((a, b) => a + (b || 0), 0) * 100) / 100
    if (total === 1.0) runAllocate({
      module, selectedArr: [...selectedRef.current], auto, weights: nw, roc, quarter,
    })
  }

  async function exportPng() {
    const el = document.getElementById('planogram-shelves-export')
    let title: string
    if (zone === 'GONDOL') {
      title = planogram?.station || 'gondolbasi_planogram'
    } else if (isChoco(zone)) {
      title = choco?.title || 'cikolata_planogram'
    } else {
      alert('PNG aktarımı yalnızca Gondol başı veya Çikolata planogramları için kullanılabilir.')
      return
    }
    if (!el || !el.children.length) {
      alert('Aktarılacak raf bulunamadı.')
      return
    }
    setBusy(true)
    try {
      const safe = title.replace(/[^\w\u00C0-\u024F-]+/g, '_').slice(0, 60)
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `${safe}_${quarter}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) { console.error(e); alert('PNG oluşturulamadı. Tekrar deneyin.') }
    finally { setBusy(false) }
  }

  async function doLogout() {
    await apiLogout()
    onLogout()
  }

  async function addGondolProduct(p: Omit<GondolProduct, 'id'>) {
    setBusy(true)
    try {
      const saved = await createCustomProduct({
        target: 'gondol',
        sku: p.name,
        cluster_key: p.clusterKey,
        display_name: p.displayName,
        color: p.color,
        shelf: p.shelf,
        width_cm: p.width_cm,
        sales: p.sales ?? 0,
      })
      setGondolExtraProducts(prev => [...prev, {
        ...p,
        id: saved.id,
      }])
      setZone('GONDOL')
      setShelf('ALL')
      setDrawerOpen(true)
      await fetchPlanogram(roc, quarter, [...selectedRef.current])
    } catch (e) {
      if (!handleAuth(e)) { console.error(e); alert('Ürün kaydedilemedi.') }
    } finally { setBusy(false) }
  }
  async function removeGondolProduct(id: number) {
    setBusy(true)
    try {
      await deleteCustomProduct(id)
      const productToRemove = gondolExtraProducts.find(p => p.id === id)
      setGondolExtraProducts(prev => prev.filter(p => p.id !== id))
      if (productToRemove) {
        const sel = new Set(selectedRef.current)
        sel.delete(productToRemove.name)
        selectedRef.current = sel
        await fetchPlanogram(roc, quarter, [...sel])
      } else {
        await fetchPlanogram(roc, quarter, [...selectedRef.current])
      }
    } catch (e) {
      if (!handleAuth(e)) { console.error(e); alert('Ürün silinemedi.') }
    } finally { setBusy(false) }
  }
  async function addChocolateDraftProduct(p: Omit<ChocolateDraftProduct, 'id'>) {
    const chocoZone = p.target === 'choco3' ? 'CHOCO3' : 'CHOCO2'
    const module = p.target === 'choco3' ? '3' : '2'
    const skuName = p.sku.trim()
    setBusy(true)
    try {
      const saved = await createCustomProduct({
        target: p.target,
        sku: skuName,
        width_cm: p.genislikCm,
        marka: p.marka,
        alt_kategori: p.altKategori,
        tahmini_skor: p.tahminiSkor,
        yerlesim: p.yerlesim,
        urun_tipi: p.urunTipi,
      })
      setChocolateDraftProducts(prev => [...prev, { ...p, id: saved.id }])

      setZone(chocoZone)
      setShelf('ALL')
      setDrawerOpen(true)

      // Sadece hedef chocolate zone'undaki seçili ürünler korunur; diğer zone'ların SKU'ları dahil edilmez.
      const sameZone = zone === chocoZone
      const previousSelected = sameZone ? drawerSKUs.filter(s => s.selected).map(s => s.name) : []
      const sel = new Set([...previousSelected, skuName])
      setAuto(false)
      selectedRef.current = sel

      const skus = await getChocolateSkus(module, weights, roc, quarter)
      setDrawerSKUs(skus)
      await runAllocate({
        module, selectedArr: [...sel], auto: false, weights, roc, quarter,
      })
    } catch (e) {
      if (!handleAuth(e)) { console.error(e); alert('Ürün kaydedilemedi.') }
    } finally { setBusy(false) }
  }
  async function removeChocolateDraftProduct(id: number) {
    setBusy(true)
    try {
      await deleteCustomProduct(id)
      setChocolateDraftProducts(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      if (!handleAuth(e)) { console.error(e); alert('Ürün silinemedi.') }
    } finally { setBusy(false) }
  }

  const pngDisabled = !isChoco(zone) && zone !== 'GONDOL'
  const selectedCount = drawerSKUs.filter(s => s.selected).length

  return (
    <div className="page-shell">
      <header className="brand-strip">
        <div className="brand">
          <img className="shell-logo" src={`${STATIC}/shell-logo.png`} alt="Shell" width={40} height={40} />
          <div className="brand-text">
            <span className="brand-name">Planogram</span>
            <span className="brand-sub">Shell · Raf optimizasyonu{ctx.is_admin ? ' · Yönetici paneli' : ''}</span>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <section>
            <h2>Raf filtrele</h2>
            {ctx.fixture_areas.map((area, idx) => (
              <div key={area.id}>
                <div className={`fixture-area ${area.id === zone ? 'active' : ''}`}>
                  <div className="fixture-head">
                    <span className="fixture-title">
                      {area.priority && <span className="fixture-star" title="Öncelikli">★</span>}
                      {area.label}
                    </span>
                    <span className={`fixture-count ${!area.product_count ? 'empty' : ''}`}>
                      {area.product_count ? `${area.product_count} ürün` : 'ürün yok'}
                    </span>
                  </div>
                  <div className="fixture-shelves">
                    {area.shelves.map(sh => (
                      <button
                        type="button"
                        key={sh.id}
                        className={`shelf-btn ${area.id === zone && sh.id === shelf ? 'active' : ''}`}
                        onClick={() => selectFixture(area.id, sh.id)}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                </div>
                {idx !== ctx.fixture_areas.length - 1 && <div style={{ height: 10 }} />}
              </div>
            ))}
          </section>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {!ctx.is_admin && <span className="toolbar-station">{ctx.user.display_name}</span>}
              {ctx.is_admin && (
                <select
                  className="station-select"
                  value={roc}
                  onChange={e => selectStation(Number(e.target.value))}
                >
                  {ctx.stations.map(s => (
                    <option key={s.roc} value={s.roc}>{s.name} · {s.roc}</option>
                  ))}
                </select>
              )}
              <div className="q-group">
                {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                  <button key={q} className={`q-btn ${q === quarter ? 'active' : ''}`} onClick={() => selectQuarter(q)}>{q}</button>
                ))}
              </div>
              {(zone === 'GONDOL' || isChoco(zone)) && (
                <button type="button" className={`btn-png ${drawerOpen ? 'active' : ''}`} onClick={() => setDrawerOpen(o => !o)}>
                  Ürün Listesi ({selectedCount})
                </button>
              )}
            </div>

            <div className="topbar-actions">
              {onHome && (
                <button type="button" className="btn-png" onClick={onHome}>← İstasyonlar</button>
              )}
              <button type="button" className="btn-png" onClick={exportPng} disabled={pngDisabled}>PNG aktar</button>
              <button type="button" className="btn-png" onClick={() => setAddProductOpen(true)}>
                Ürün Ekle
              </button>
              <div className="user-menu">
                <span className="user-badge"><strong>{ctx.user.display_name}</strong></span>
                <button className="btn-logout" onClick={doLogout}>Çıkış</button>
              </div>
            </div>
          </header>

          <main className="page">
            {zone === 'GONDOL' && <GondolView data={planogram} shelf={shelf} extraProducts={gondolExtraProducts} />}

            {isChoco(zone) && (
              <ChocolateView
                data={choco}
                shelf={shelf}
                weights={weights ?? choco?.weights ?? {}}
                onWeightChange={onWeightChange}
              />
            )}

            {(zone === 'CIPS' || zone === 'JELIBON') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '80px 40px',
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                textAlign: 'center',
                marginTop: '20px'
              }}>
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
                  {zone === 'CIPS' ? 'Cips Planogramı' : 'Jelibon Planogramı'}
                </h3>
                <p style={{ color: 'var(--sub)', fontSize: '14px', margin: 0 }}>
                  Aktif planogram bulunmamaktadır.
                </p>
              </div>
            )}
          </main>
        </div>

        <RightDrawer
          open={drawerOpen && (zone === 'GONDOL' || isChoco(zone))}
          skus={drawerSKUs}
          module={zone === 'GONDOL' ? 'gondol' : module}
          auto={auto}
          capacityPct={zone === 'GONDOL' ? 0 : (choco?.kpis.capacity_fill_pct ?? 0)}
          search={search}
          onSearch={setSearch}
          onSelectAll={selectAllSKUs}
          onClear={clearAllSKUs}
          onToggleAuto={toggleAutoRecommend}
          onToggleSku={toggleSku}
          onClose={() => setDrawerOpen(false)}
        />
      </div>

      <div className={`loading ${busy ? 'show' : ''}`}>
        <div className="spin-wrap">
          <div className="spinner" />
          <div className="spin-txt">Yükleniyor…</div>
        </div>
      </div>

      <AddProductModal
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        gondolProducts={gondolExtraProducts}
        onAddGondol={addGondolProduct}
        onRemoveGondol={removeGondolProduct}
        chocolateProducts={chocolateDraftProducts}
        onAddChocolate={addChocolateDraftProduct}
        onRemoveChocolate={removeChocolateDraftProduct}
      />
    </div>
  )
}
