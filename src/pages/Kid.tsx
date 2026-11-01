import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalog, getColor, partsInCategory, searchParts } from '../catalog'
import { PartImage } from '../components/PartImage'
import { useCart } from '../store/cart'
import type { CatalogPart } from '../types'
import { PartPicker } from './PartPicker'

export function Kid() {
  const cart = useCart()
  const [cat, setCat] = useState(catalog.categories[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState<CatalogPart | null>(null)

  const query = q.trim()
  const parts = useMemo(() => (query ? searchParts(query) : partsInCategory(cat)), [cat, query])
  const total = cart.reduce((n, i) => n + i.qty, 0)

  return (
    <main className="page kid">
      <header className="kid-header">
        <h1>ほしいパーツ</h1>
        <div className="kid-header-actions">
          <Link className="btn btn-ghost" to="/kid/history">
            履歴
          </Link>
          <Link className="btn btn-cart" to="/kid/cart" aria-label="カートを見る">
            🛒 カート <span className="count">{total}</span>
          </Link>
        </div>
      </header>

      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="パーツ名や番号で検索（例: 14417、クリップ）" autoCapitalize="none" />

      {!query && (
        <nav className="cats" aria-label="カテゴリ">
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
              <PartImage partNum={p.num} colorId={c0?.color_id ?? 15} elementId={c0?.element_id ?? null} rgb={getColor(c0?.color_id ?? 15)?.rgb} isTrans={getColor(c0?.color_id ?? 15)?.is_trans} category={p.category} alt={p.name_ja} />
              <span className="tile-name">{p.name_ja}</span>
              <span className="tile-num">{p.num}</span>
            </button>
          )
        })}
      </section>
      {parts.length === 0 && <p className="empty">見つかりませんでした</p>}

      {picking && <PartPicker part={picking} onClose={() => setPicking(null)} />}

      <footer className="kid-footer">
        <Link to="/parent">保護者の方はこちら</Link>
      </footer>
    </main>
  )
}
