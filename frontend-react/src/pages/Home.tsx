import { useEffect, useState } from 'react'
import type { MeContext, StationSummary } from '../types'
import { getStationsSummary, logout as apiLogout } from '../api'
import { STATIC } from '../util'

interface Props {
  ctx: MeContext
  onSelectStation: (roc: number) => void
  onLogout: () => void
}

function fmtSales(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

const ZONE_COLOR: Record<string, string> = {
  GONDOL: '#2e7d5e',
  CHOCO3: '#7b4f2e',
  CHOCO2: '#a0622a',
}

export default function Home({ ctx, onSelectStation, onLogout }: Props) {
  const [stations, setStations] = useState<StationSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStationsSummary()
      .then(setStations)
      .finally(() => setLoading(false))
  }, [])

  const filtered = stations.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.roc).includes(search)
  )

  async function doLogout() {
    await apiLogout()
    onLogout()
  }

  return (
    <div className="page-shell">
      <header className="brand-strip">
        <div className="brand">
          <img className="shell-logo" src={`${STATIC}/shell-logo.png`} alt="Shell" width={40} height={40} />
          <div className="brand-text">
            <span className="brand-name">Planogram</span>
            <span className="brand-sub">Shell · Raf optimizasyonu</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="user-badge"><strong>{ctx.user.display_name}</strong></span>
          <button className="btn-logout" onClick={doLogout}>Çıkış</button>
        </div>
      </header>

      <div className="home-wrap">
        <div className="home-toolbar">
          <div className="home-title-block">
            <h1 className="home-title">İstasyonlar</h1>
            {!loading && <span className="home-meta">{filtered.length} istasyon</span>}
          </div>
          <input
            className="home-search"
            type="search"
            placeholder="İstasyon adı veya ROC ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="home-loading">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="home-empty">Eşleşen istasyon bulunamadı.</div>
        ) : (
          <div className="station-grid">
            {filtered.map(s => (
              <button
                key={s.roc}
                type="button"
                className="sc-card"
                onClick={() => onSelectStation(s.roc)}
              >
                <div className="sc-section">
                  <span className="sc-label">İstasyon</span>
                  <span className="sc-station-name">{s.name}</span>
                  <span className="sc-roc">{s.roc}</span>
                </div>

                <div className="sc-divider" />

                <div className="sc-section">
                  <span className="sc-label">Aktif Planogramlar</span>
                  <div className="sc-zones">
                    {s.active_zones.map(z => (
                      <span
                        key={z.id}
                        className="sc-zone"
                        style={{ '--zc': ZONE_COLOR[z.id] ?? '#607d8b' } as React.CSSProperties}
                      >
                        {z.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="sc-divider" />

                <div className="sc-bottom">
                  <div className="sc-section">
                    <span className="sc-label">Yıllık</span>
                    <span className="sc-sales">{fmtSales(s.annual_sales)}</span>
                  </div>
                  <div className="sc-section sc-section-right">
                    <span className="sc-label">Durum</span>
                    <span className={`sc-status sc-status-${s.status}`}>
                      {s.status === 'taslak' ? 'Taslak' : s.status}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
