import { useEffect, useMemo, useState } from 'react'
import { getColor } from '../catalog'
import { CartButton } from '../components/CartButton'
import { Icon } from '../components/Icon'
import { KidNav } from '../components/KidNav'
import { Loading } from '../components/Loading'
import { PartImage } from '../components/PartImage'
import { loadAllParts, searchAllParts, toCatalogPart, type AllPartsIndex } from '../lib/allParts'
import { SHOP } from '../lib/shop'
import type { CatalogPart } from '../types'
import { PartPicker } from './PartPicker'

/** 「ぜんぶ」タブ: 厳選カタログに無いふつうのパーツを、Rebrickable 由来の索引から探す。価格は持たない */
export function KidAll() {
  const [index, setIndex] = useState<AllPartsIndex | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [picking, setPicking] = useState<CatalogPart | null>(null)

  useEffect(() => {
    let alive = true
    loadAllParts()
      .then((i) => alive && setIndex(i))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const parts = useMemo(() => (index ? searchAllParts(index, q, cat) : []), [index, q, cat])

  return (
    <main className="page kid">
      <header className="kid-header">
        <div className="title">
          <span className="eyebrow">Brick Wish</span>
          <h1>ぜんぶのパーツ</h1>
        </div>
        <CartButton />
      </header>

      <p className="cat-desc">カタログに無いふつうのパーツを、番号か英語の名前で探せます。価格は保護者が{SHOP.name}で確かめるので、送ると保護者の確認に回ります。</p>

      <div className="search-wrap">
        <Icon name="search" size={18} />
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="番号か英語名（例: 3001、brick 2 x 4）" autoCapitalize="none" autoFocus />
      </div>

      {index && (
        <nav className="cats" aria-label="カテゴリ">
          <button type="button" className={`cat ${cat == null ? 'active' : ''}`} onClick={() => setCat(null)} aria-pressed={cat == null}>
            すべて
          </button>
          {index.categories.map((c) => (
            <button key={c.id} type="button" className={`cat ${c.id === cat ? 'active' : ''}`} onClick={() => setCat(c.id)} aria-pressed={c.id === cat}>
              {c.name_ja}
            </button>
          ))}
        </nav>
      )}

      {!index && !err && <Loading label="パーツ索引を読み込んでいます" />}
      {err && <p className="error">索引を読み込めませんでした（{err}）。`npm run all-parts` で public/all-parts.json を作ってください。</p>}

      {index && (
        <div className="list-meta">
          <span>
            {cat != null ? index.byCat.get(cat)?.name_ja : 'すべて'} · {parts.length}
            {parts.length >= 60 ? '+' : ''} 種類
          </span>
          <span>{index.min_year} 年以降のセットのパーツ</span>
        </div>
      )}

      <section className="grid">
        {index &&
          parts.map((p) => {
            const c0 = p.colors[0]
            const color = c0 ? getColor(c0.color_id) : undefined
            const glyph = index.byCat.get(p.cat)?.glyph ?? 'basic'
            return (
              <button key={p.num} type="button" className="tile" onClick={() => setPicking(toCatalogPart(p, index))}>
                <PartImage partNum={p.num} colorId={c0?.color_id ?? 15} elementId={c0?.element_id ?? null} rgb={color?.rgb} isTrans={color?.is_trans} category={glyph} alt={p.name} />
                <span className="tile-name">{p.name}</span>
                <span className="tile-meta">
                  <span className="tile-num">{p.num}</span>
                  <span className="tile-price unknown">{p.colors.length} 色</span>
                </span>
              </button>
            )
          })}
      </section>
      {index && parts.length === 0 && <p className="empty">見つかりませんでした</p>}

      {index && (
        <footer className="kid-footer">
          <p className="muted small">
            パーツのデータと画像:{' '}
            <a href="https://rebrickable.com/" target="_blank" rel="noopener noreferrer">
              Rebrickable
            </a>
          </p>
        </footer>
      )}

      {picking && <PartPicker part={picking} onClose={() => setPicking(null)} priceless />}
      <KidNav />
    </main>
  )
}
