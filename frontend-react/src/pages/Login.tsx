import { useEffect, useState } from 'react'
import type { MeContext, DemoAccount } from '../types'
import { login, getDemoAccounts } from '../api'
import { STATIC } from '../util'

export default function Login({ onLoggedIn }: { onLoggedIn: (ctx: MeContext) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { getDemoAccounts().then(setAccounts) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const ctx = await login(username, password)
      onLoggedIn(ctx)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <img src={`${STATIC}/shell-logo.png`} alt="Shell" />
          <div>
            <h1>Planogram</h1>
            <p>Shell · Raf optimizasyonu</p>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={submit}>
          <label>
            <span>Kullanıcı adı</span>
            <input
              name="username"
              autoComplete="username"
              required
              placeholder="İstasyon adı veya admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </label>
          <label>
            <span>Şifre</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
        </form>

        {accounts.length > 0 && (
          <div className="demo">
            <strong>Demo hesaplar (yerel)</strong>
            {accounts.map((a, i) => (
              <div key={i}>{a.role}: <code>{a.user}</code> / {a.pass}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
