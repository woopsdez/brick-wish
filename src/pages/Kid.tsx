import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalog, getColor, partsInCategory, searchParts } from '../catalog'
import { Icon } from '../components/Icon'
import { KidNav } from '../components/KidNav'
import { PartImage } from '../components/PartImage'
import { yen } from '../lib/budget'
import { SHOP, minPrice } from '../lib/shop'
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
  const current = catalog.categories.find((c) => c.id === cat)
  const fetched = new Date(SHOP.fetchedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })

  return (
    <main className="page kid">
      <header className="kid-header">
        <div className="title">
          <span className="eyebrow">Brick Wish</span>
          <h1>ほしいパーツ</h1>
        </div>
        <Link className="btn btn-cart" to="/kid/cart" aria-label={`カートを見る、${total} 個`}>
          <Icon name="cart" />
          <span className="count">{total}</span>
        </Link>
      </header>

      <div className="search-wrap">
        <Icon name="search" size={18} />
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="パーツ名・番号で検索" autoCapitalize="none" />
      </div>

      {!query && (
        <nav className="cats" aria-label="カテゴリ">
          {catalog.categories.map((c) => (
            <button key={c.id} type="button" className={`cat ${c.id === cat ? 'active' : ''}`} onClick={() => setCat(c.id)} aria-pressed={c.id === cat}>
              {c.name_ja}
            </button>
          ))}
        </nav>
      )}

      <div className="list-meta">
        <span>{query ? `「${query}」 · ${parts.length} 種類` : `${current?.name_ja ?? ''} · ${parts.length} 種類`}</span>
        <span>{SHOP.sample ? '価格はサンプル' : `${SHOP.name} ${fetched} 時点の価格`}</span>
      </div>

      <section className="grid">
        {parts.map((p) => {
          const c0 = p.colors[0]
          const price = minPrice(p)
          return (
            <button key={p.num} type="button" className={`tile ${price == null ? 'soldout' : ''}`} onClick={() => setPicking(p)}>
              <PartImage partNum={p.num} colorId={c0?.color_id ?? 15} elementId={c0?.element_id ?? null} rgb={getColor(c0?.color_id ?? 15)?.rgb} isTrans={getColor(c0?.color_id ?? 15)?.is_trans} category={p.category} alt={p.name_ja} />
              <span className="tile-name">{p.name_ja}</span>
              <span className="tile-meta">
                <span className="tile-num">{p.num}</span>
                <span className="tile-price">{price != null ? `${yen(price)}〜` : '在庫なし'}</span>
              </span>
            </button>
          )
        })}
      </section>
      {parts.length === 0 && <p className="empty">見つかりませんでした</p>}

      {picking && <PartPicker part={picking} onClose={() => setPicking(null)} />}

      <footer className="kid-footer">
        {SHOP.sample && <p className="muted small">価格はサンプルです（{SHOP.name}の実データは scripts/build-shop-map.mjs で取得）</p>}
        <Link to="/parent">保護者の方はこちら</Link>
      </footer>
      <KidNav />
    </main>
  )
}
