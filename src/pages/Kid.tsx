import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalog, partsInCategory, searchParts } from '../catalog'
import { PartImage } from '../components/PartImage'
import { useCart } from '../store/cart'
import { useSettings } from '../store/settings'
import type { CatalogPart } from '../types'
import { PartPicker } from './PartPicker'

export function Kid() {
  const settings = useSettings()
  const cart = useCart()
  const [cat, setCat] = useState(catalog.categories[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState<CatalogPart | null>(null)

  const parts = useMemo(() => (q.trim() ? searchParts(q) : partsInCategory(cat)), [cat, q])
  const total = cart.reduce((n, i) => n + i.qty, 0)

  return (
    <main className="page kid">
      <header className="kid-header">
        <h1>
          🧱 {settings.kidName || 'こども'}の ほしいもの
        </h1>
        <div className="kid-header-actions">
          <Link className="btn btn-ghost" to="/kid/history">
            📜 まえの おねがい
          </Link>
          <Link className="btn btn-cart" to="/kid/cart" aria-label="かごをみる">
            🛒 かご <span className="count">{total}</span>
          </Link>
        </div>
      </header>

      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 なまえや ばんごうで さがす" />

      {!q.trim() && (
        <nav className="cats" aria-label="しゅるい">
          {catalog.categories.map((c) => (
            <button key={c.id} className={`cat ${c.id === cat ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              <span className="emoji">{c.emoji}</span>
              {c.name_ja}
            </button>
          ))}
        </nav>
      )}

      <section className="grid">
        {parts.map((p) => {
          const c0 = p.colors[0]
          return (
            <button key={p.num} className="tile" onClick={() => setPicking(p)}>
              <PartImage partNum={p.num} colorId={c0?.color_id ?? 15} elementId={c0?.element_id ?? null} alt={p.name_ja} />
              <span className="tile-name">{p.name_ja}</span>
              <span className="tile-num">{p.num}</span>
            </button>
          )
        })}
        {parts.length === 0 && <p className="muted">みつからなかった…</p>}
      </section>

      {picking && <PartPicker part={picking} onClose={() => setPicking(null)} />}
    </main>
  )
}
