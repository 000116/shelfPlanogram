import { useMemo, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import type { GondolProduct, ShelfKey } from './gondolConstants'
import { CLUSTER_MAPPING, CLUSTER_DISPLAY, CLUSTER_COLOR, SHELF_OF_CLUSTER, DEFAULT_COLOR } from './gondolConstants'
import ProductPlacement from './ProductPlacement'
import ManualProductEntry from './ManualProductEntry'

type Row = (string | number | null)[]

interface CheckItem { label: string; ok: boolean; detail: string }
interface StatItem { label: string; value: string }
interface PreviewTable { title: string; headers: string[]; rows: Row[] }

interface AnalysisResult {
  fileName: string
  kind: 'gondolbasi' | 'cikolata' | 'unknown'
  kindLabel: string
  sheetNames: string[]
  checks: CheckItem[]
  stats: StatItem[]
  previews: PreviewTable[]
  products?: GondolProduct[]
}

const QUARTER_MAP: Record<string, string> = {
  'OCAK': 'Q1', 'ŞUBAT': 'Q1', 'MART': 'Q1',
  'NİSAN': 'Q2', 'MAYIS': 'Q2', 'HAZİRAN': 'Q2',
  'TEMMUZ': 'Q3', 'AĞUSTOS': 'Q3', 'EYLÜL': 'Q3',
  'EKİM': 'Q4', 'KASIM': 'Q4', 'ARALIK': 'Q4',
}

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true })
}

function asStr(v: string | number | null): string {
  return v == null ? '' : String(v).trim()
}

function checkHeaders(headers: string[], required: string[]): CheckItem[] {
  return required.map(h => ({
    label: `Sütun: "${h}"`,
    ok: headers.includes(h),
    detail: headers.includes(h) ? 'bulundu' : 'eksik',
  }))
}

function previewTable(title: string, rows: Row[], headerRowIdx: number, maxRows = 6): PreviewTable {
  const headers = (rows[headerRowIdx] || []).map(asStr)
  const dataRows = rows.slice(headerRowIdx + 1, headerRowIdx + 1 + maxRows)
  return { title, headers, rows: dataRows }
}

function rafToShelf(v: string | number | null): ShelfKey {
  const n = Number(v)
  if (n === 2) return 'orta'
  if (n === 3) return 'alt'
  return 'ust'
}

function extractGondolProducts(wb: XLSX.WorkBook): GondolProduct[] {
  const rows = sheetRows(wb, 'Ürün Listesi')
  const headers = (rows[0] || []).map(asStr)
  const idIdx = headers.indexOf('Ürün ID')
  const nameIdx = headers.indexOf('Ürün Adı')
  const clusterIdx = headers.indexOf('Ürün Listesi')
  const rafIdx = headers.indexOf('Raf')
  const widthIdx = headers.indexOf('Ürün_cm')
  if (nameIdx < 0) return []
  const out: GondolProduct[] = []
  rows.slice(1).forEach((r, i) => {
    const name = asStr(r[nameIdx])
    if (!name) return
    const clusterRaw = asStr(r[clusterIdx]).toUpperCase()
    const clusterKey = CLUSTER_MAPPING[clusterRaw] ?? clusterRaw
    const shelf = SHELF_OF_CLUSTER[clusterKey] ?? rafToShelf(r[rafIdx])
    out.push({
      id: idIdx >= 0 ? (Number(r[idIdx]) || i + 1) : i + 1,
      name,
      clusterKey,
      displayName: CLUSTER_DISPLAY[clusterKey] ?? clusterKey,
      color: CLUSTER_COLOR[clusterKey] ?? DEFAULT_COLOR,
      shelf,
      width_cm: Number(r[widthIdx]) || 0,
    })
  })
  return out
}

function analyzeGondolbasi(wb: XLSX.WorkBook, fileName: string): AnalysisResult {
  const checks: CheckItem[] = []
  const stats: StatItem[] = []
  const previews: PreviewTable[] = []

  const ulRows = sheetRows(wb, 'Ürün Listesi')
  const ulHeaders = (ulRows[0] || []).map(asStr)
  checks.push(...checkHeaders(ulHeaders, ['Ürün Adı', 'Ürün Listesi', 'Raf', 'Ürün_cm']))
  const prodIdx = ulHeaders.indexOf('Ürün Adı')
  const clusterIdx = ulHeaders.indexOf('Ürün Listesi')
  const products = prodIdx >= 0 ? ulRows.slice(1).filter(r => asStr(r[prodIdx])) : []
  stats.push({ label: 'Gondol ürün sayısı ("Ürün Listesi" sayfası)', value: String(products.length) })
  if (clusterIdx >= 0) {
    const clusters = new Set(products.map(r => asStr(r[clusterIdx])).filter(Boolean))
    stats.push({ label: 'Farklı ürün kümesi sayısı', value: String(clusters.size) })
  }
  previews.push(previewTable('Ürün Listesi', ulRows, 0))

  const salesRows = sheetRows(wb, '2025')
  const salesHeaders = (salesRows[0] || []).map(asStr)
  checks.push(...checkHeaders(salesHeaders, ['AY', 'İstasyon Adı', 'Roc Kodu', 'Malzeme Açıklaması', 'Net Satış Miktarı']))
  const ayIdx = salesHeaders.indexOf('AY')
  const rocIdx = salesHeaders.indexOf('Roc Kodu')
  const stnIdx = salesHeaders.indexOf('İstasyon Adı')
  const qtyIdx = salesHeaders.indexOf('Net Satış Miktarı')
  const dataRows = salesRows.slice(1).filter(r => asStr(r[rocIdx]) && asStr(r[ayIdx]))
  if (rocIdx >= 0 && ayIdx >= 0) {
    const stations = new Map<string, string>()
    const quarters = new Set<string>()
    let unmapped = 0
    let totalQty = 0
    for (const r of dataRows) {
      const roc = asStr(r[rocIdx])
      const name = asStr(r[stnIdx])
      if (roc) stations.set(roc, name)
      const ay = asStr(r[ayIdx]).toUpperCase()
      const q = QUARTER_MAP[ay]
      if (q) quarters.add(q)
      else if (ay) unmapped++
      const qty = Number(r[qtyIdx])
      if (Number.isFinite(qty)) totalQty += qty
    }
    stats.push({ label: 'Satış satırı sayısı ("2025" sayfası)', value: String(dataRows.length) })
    stats.push({ label: 'Farklı istasyon (ROC) sayısı', value: String(stations.size) })
    stats.push({ label: 'Tanımlı çeyrek (Q1-Q4) sayısı', value: String(quarters.size) })
    stats.push({ label: 'Toplam net satış miktarı', value: totalQty.toLocaleString('tr-TR') })
    if (unmapped > 0) {
      checks.push({ label: 'Ay → Çeyrek eşlemesi', ok: false, detail: `${unmapped} satırda tanınmayan ay değeri var` })
    } else {
      checks.push({ label: 'Ay → Çeyrek eşlemesi', ok: true, detail: 'tüm aylar Q1-Q4 ile eşleşti' })
    }
  }
  previews.push(previewTable('2025 (Satış)', salesRows, 0))

  return {
    fileName, kind: 'gondolbasi', kindLabel: 'Gondolbaşı satış verisi (gondolbasi.xlsx formatı)',
    sheetNames: wb.SheetNames, checks, stats, previews,
    products: extractGondolProducts(wb),
  }
}

function analyzeCikolata(wb: XLSX.WorkBook, fileName: string): AnalysisResult {
  const checks: CheckItem[] = []
  const stats: StatItem[] = []
  const previews: PreviewTable[] = []

  const dbRows = sheetRows(wb, 'DB')
  const dbHeaders = (dbRows[0] || []).map(asStr)
  checks.push(...checkHeaders(dbHeaders, ['Ürün ID', 'SKU', 'Marka', 'Alt Kategori', 'Genişlik (cm)', 'SKOR', 'Yerleşim', 'Ürün Tipi']))
  const dbIdIdx = dbHeaders.indexOf('Ürün ID')
  const dbProducts = dbIdIdx >= 0 ? dbRows.slice(1).filter(r => asStr(r[dbIdIdx])) : []
  stats.push({ label: 'Ürün sayısı ("DB" sayfası)', value: String(dbProducts.length) })
  previews.push(previewTable('DB', dbRows, 0))

  const vsRows = sheetRows(wb, 'Veri_Skor')
  const vsHeaders = (vsRows[6] || []).map(asStr)
  checks.push(...checkHeaders(vsHeaders, [
    'Ürün ID', 'SKU', 'Satış adeti', 'Net Birim Kâr', 'C2', 'Ciro Payı',
    'Nielsen GasSt', 'Nielsen SPM', 'Deli2go', 'Max Facing', 'Mevcut önyüz', 'Min Facing', 'Ürün Tipi',
  ]))
  const vsIdIdx = vsHeaders.indexOf('Ürün ID')
  const vsProducts = vsIdIdx >= 0
    ? vsRows.slice(7).filter(r => asStr(r[vsIdIdx]) && asStr(r[vsIdIdx]) !== 'None')
    : []
  stats.push({ label: 'Skorlanmış ürün sayısı ("Veri_Skor" sayfası)', value: String(vsProducts.length) })
  previews.push(previewTable('Veri_Skor (8. satırdan itibaren)', vsRows, 6))

  const stationSheets = wb.SheetNames.filter(n => /^\d/.test(n) && n.includes(' '))
  let validStationSheets = 0
  for (const name of stationSheets) {
    const rows = sheetRows(wb, name)
    const headers = (rows[1] || []).map(asStr)
    if (['Ürün ID', 'Q1', 'Q2', 'Q3', 'Q4'].every(h => headers.includes(h))) validStationSheets++
  }
  stats.push({ label: 'İstasyon bazlı satış sayfası sayısı', value: String(stationSheets.length) })
  checks.push({
    label: 'İstasyon satış sayfaları (Ürün ID, Q1-Q4)',
    ok: stationSheets.length > 0 && validStationSheets === stationSheets.length,
    detail: stationSheets.length === 0
      ? 'hiç istasyon sayfası bulunamadı (sayfa adı "ROC İsim" formatında olmalı)'
      : `${validStationSheets}/${stationSheets.length} sayfa beklenen sütunlara sahip`,
  })

  return {
    fileName, kind: 'cikolata', kindLabel: 'Çikolata ürün ve skor verisi (cikolata.xlsx formatı)',
    sheetNames: wb.SheetNames, checks, stats, previews,
  }
}

function analyzeUnknown(wb: XLSX.WorkBook, fileName: string): AnalysisResult {
  const previews: PreviewTable[] = []
  const stats: StatItem[] = wb.SheetNames.map(name => {
    const rows = sheetRows(wb, name)
    const cols = rows[0]?.length || 0
    return { label: `"${name}" sayfası`, value: `${Math.max(rows.length - 1, 0)} satır · ${cols} sütun` }
  })
  if (wb.SheetNames.length > 0) {
    previews.push(previewTable(wb.SheetNames[0], sheetRows(wb, wb.SheetNames[0]), 0))
  }
  return {
    fileName, kind: 'unknown',
    kindLabel: 'Tanınmayan format — "gondolbasi.xlsx" veya "cikolata.xlsx" şablonuyla eşleşmedi',
    sheetNames: wb.SheetNames,
    checks: [],
    stats,
    previews,
  }
}

function analyzeWorkbook(wb: XLSX.WorkBook, fileName: string): AnalysisResult {
  const names = wb.SheetNames
  if (names.includes('Ürün Listesi') && names.includes('2025')) return analyzeGondolbasi(wb, fileName)
  if (names.includes('DB') && names.includes('Veri_Skor')) return analyzeCikolata(wb, fileName)
  return analyzeUnknown(wb, fileName)
}

export default function DataImportView() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [manualProducts, setManualProducts] = useState<GondolProduct[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const allProducts = useMemo(
    () => [...(result?.products ?? []), ...manualProducts],
    [result, manualProducts],
  )

  function addManualProduct(p: Omit<GondolProduct, 'id'>) {
    setManualProducts(prev => [...prev, { ...p, id: -(prev.length + 1) }])
  }
  function removeManualProduct(id: number) {
    setManualProducts(prev => prev.filter(p => p.id !== id))
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      setResult(analyzeWorkbook(wb, file.name))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı. Geçerli bir .xlsx dosyası seçin.')
    } finally {
      setBusy(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const okCount = result?.checks.filter(c => c.ok).length ?? 0
  const totalChecks = result?.checks.length ?? 0

  return (
    <div className="panel-main">
      <div className="page-top">
        <div>
          <div className="page-title">Excel Veri Yükleme</div>
          <div className="page-sub">
            gondolbasi.xlsx / cikolata.xlsx şablonlarıyla uyumluluğu kontrol edin ve içeriği önizleyin
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">Dosya Seç</div>
        <div
          className={`xlsx-drop ${dragOver ? 'over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={onInputChange}
          />
          <div className="xlsx-drop-icon">📄</div>
          <div className="xlsx-drop-text">
            <strong>.xlsx dosyasını sürükleyin</strong> veya tıklayıp seçin
          </div>
          <div className="xlsx-drop-hint">
            Yalnızca tarayıcıda işlenir; dosya sunucuya gönderilmez.
          </div>
        </div>
        {busy && <div className="xlsx-status">Dosya okunuyor…</div>}
        {error && <div className="xlsx-status error">{error}</div>}
      </div>

      <ManualProductEntry
        products={manualProducts}
        onAdd={addManualProduct}
        onRemove={removeManualProduct}
      />

      {allProducts.length > 0 && (
        <ProductPlacement products={allProducts} />
      )}

      {result && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Sonuç</div>
            <div className="xlsx-summary">
              <div><strong>Dosya:</strong> {result.fileName}</div>
              <div><strong>Tespit edilen format:</strong> {result.kindLabel}</div>
              <div><strong>Sayfalar ({result.sheetNames.length}):</strong> {result.sheetNames.join(', ')}</div>
              {totalChecks > 0 && (
                <div>
                  <strong>Şema kontrolü:</strong> {okCount}/{totalChecks} kontrol geçti
                </div>
              )}
            </div>
          </div>

          {result.checks.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Şema Kontrolleri</div>
              <div className="xlsx-checks">
                {result.checks.map((c, i) => (
                  <div className="xlsx-check" key={i}>
                    <span className={`xlsx-check-icon ${c.ok ? 'ok' : 'fail'}`}>{c.ok ? '✓' : '✗'}</span>
                    <span className="xlsx-check-label">{c.label}</span>
                    <span className="xlsx-check-detail">{c.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.stats.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">İçerik Özeti</div>
              <div className="xlsx-stats">
                {result.stats.map((s, i) => (
                  <div className="xlsx-stat" key={i}>
                    <span className="xlsx-stat-label">{s.label}</span>
                    <span className="xlsx-stat-value">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.previews.map((p, i) => (
            <div className="card" style={{ marginBottom: 12 }} key={i}>
              <div className="card-title">Önizleme — {p.title}</div>
              <div className="xlsx-table-wrap">
                <table className="xlsx-table">
                  <thead>
                    <tr>{p.headers.map((h, j) => <th key={j}>{h || '—'}</th>)}</tr>
                  </thead>
                  <tbody>
                    {p.rows.map((row, ri) => (
                      <tr key={ri}>
                        {p.headers.map((_, ci) => <td key={ci}>{row[ci] == null ? '' : String(row[ci])}</td>)}
                      </tr>
                    ))}
                    {p.rows.length === 0 && (
                      <tr><td colSpan={Math.max(p.headers.length, 1)} className="xlsx-empty">Veri satırı bulunamadı</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
