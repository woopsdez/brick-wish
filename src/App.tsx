import { Outlet } from 'react-router-dom'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Kid } from './pages/Kid'
import { KidCart, KidSent } from './pages/KidCart'
import { KidHistory } from './pages/KidHistory'
import { Parent } from './pages/Parent'
import { ParentRequest } from './pages/ParentRequest'
import { ParentSettings } from './pages/ParentSettings'
import { Setup } from './pages/Setup'
import { saveSettings, useSettings } from './store/settings'
import { sha256Hex } from './lib/ids'
import { getStore } from './store'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route element={<RequireRole role="kid" />}>
          <Route path="/kid" element={<Kid />} />
          <Route path="/kid/cart" element={<KidCart />} />
          <Route path="/kid/sent" element={<KidSent />} />
          <Route path="/kid/history" element={<KidHistory />} />
        </Route>
        <Route element={<RequireRole role="parent" />}>
          <Route path="/parent" element={<Parent />} />
          <Route path="/parent/request/:id" element={<ParentRequest />} />
          <Route path="/parent/settings" element={<ParentSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

function Home() {
  const s = useSettings()
  if (!s.role || !s.familyId) return <Navigate to="/setup" replace />
  return <Navigate to={s.role === 'kid' ? '/kid' : '/parent'} replace />
}

/** 役割が合わない端末からのアクセスをガードする。子端末から親画面に行くには PIN */
function RequireRole({ role }: { role: 'kid' | 'parent' }) {
  const s = useSettings()
  const loc = useLocation()
  if (!s.role || !s.familyId) return <Navigate to="/setup" replace state={{ from: loc }} />
  if (s.role === role) return <Outlet />
  if (role === 'parent') return <PinGate familyId={s.familyId} />
  return <Navigate to="/parent" replace />
}

function PinGate({ familyId }: { familyId: string }) {
  const nav = useNavigate()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function check() {
    const fam = await getStore().getFamily(familyId)
    const hash = await sha256Hex(pin)
    if (fam?.pin_hash && fam.pin_hash !== hash) {
      setErr('PIN が違います')
      return
    }
    saveSettings({ role: 'parent', localPinHash: hash })
    nav('/parent', { replace: true })
  }
  return (
    <main className="page center">
      <h1>おうちの人の画面</h1>
      <p className="muted">PIN を入れてください</p>
      <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="code-input" />
      {err && <p className="error">{err}</p>}
      <button className="btn btn-big" onClick={() => void check()}>
        ひらく
      </button>
      <button className="btn btn-ghost" onClick={() => nav('/kid')}>
        もどる
      </button>
    </main>
  )
}

