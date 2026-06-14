import { useEffect, useState, useCallback } from 'react'
import type { MeContext } from './types'
import { getMe } from './api'
import Login from './pages/Login'
import Panel from './pages/Panel'

export default function App() {
  const [me, setMe] = useState<MeContext | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getMe()
      setMe(ctx)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading && !me) {
    return (
      <div className="loading show">
        <div className="spin-wrap">
          <div className="spinner" />
          <div className="spin-txt">Yükleniyor…</div>
        </div>
      </div>
    )
  }

  if (!me || !me.authenticated) {
    return <Login onLoggedIn={setMe} />
  }

  return <Panel ctx={me} onLogout={() => setMe(null)} />
}
