import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { catalog, getColor } from '../catalog'
import { ColorSwatch } from '../components/ColorSwatch'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { ANY_COLOR_ID, ANY_COLOR_RGB, findPart, looksLikePartNum, parsePartsList, rowToCartItem, type ImportRow } from '../lib/partsImport'
import { addToCart } from '../store/cart'

const ctx = { colors: catalog.colors, parts: catalog.parts }

type Tab = 'number' | 'list'

/** カタログに無いパーツを、BrickLink の番号やパーツリストの貼り付けでカートに入れる */
export function KidAdd() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(params.has('list') ? 'list' : 'number')

  return (
    <main className="page kid">
      <header className="kid-header">
        <Link className="btn btn-ghost" to="/kid">
          ← 戻る
        </Link>
        <h1>番号・リストで追加</h1>
        <Link className="btn btn-cart" to="/kid/cart">
          🛒 カート
        </Link>
      </header>
      <p className="muted">
        カタログに無いパーツも、BrickLink の番号（Part No. / デザイン ID）が分かればそのまま頼めます。番号は brickmecha や BrickLink、Rebrickable のパーツページに書いてあります。
      </p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'number'} className={`tab ${tab === 'number' ? 'active' : ''}`} onClick={() => setTab('number')}>
          番号で 1 個ずつ
        </button>
        <button role="tab" aria-selected={tab === 'list'} className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          リストを貼り付け
        </button>
      </div>
      {tab === 'number' ? <ByNumber initial={params.get('num') ?? ''} /> : <ByList />}
    </main>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function ByNumber({ initial }: { initial: string }) {
  const [num, setNum] = useState(initial)
  const [colorId, setColorId] = useState<number>(ANY_COLOR_ID)
  const [qty, setQty] = useState(4)
  const [added, setAdded] = useState<string | null>(null)
  const clean = useDebounced(num.trim(), 400)
  const part = useMemo(() => findPart(ctx, clean), [clean])
  const valid = looksLikePartNum(clean)
  const color = colorId === ANY_COLOR_ID ? null : (getColor(colorId) ?? null)

  function add() {
    const row: ImportRow = { source: clean, num: clean, qty, color, colorText: null, part, error: null }
    addToCart(rowToCartItem(row))
    setAdded(`${part?.name_ja ?? `パーツ ${clean}`}（${color?.name_ja ?? '色指定なし'}）× ${qty} を入れました`)
    setTimeout(() => setAdded(null), 2500)
  }

  return (
    <section className="stack add-section">
      <label>
        パーツ番号
        <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="例: 14417" autoCapitalize="none" autoComplete="off" autoFocus={!initial} />
      </label>

      {clean && (
        <div className="add-preview">
          <PartImage
            key={`${clean}|${colorId}`}
            partNum={clean}
            colorId={colorId}
            elementId={null}
            rgb={color?.rgb ?? ANY_COLOR_RGB}
            isTrans={color?.is_trans}
            category={part?.category ?? 'basic'}
            alt={clean}
            className="big"
          />
          <div className="stack-tight">
            <strong>{part ? part.name_ja : `パーツ ${clean}`}</strong>
            <span className="muted">
              {part ? `${part.name} · ${part.num}` : valid ? 'カタログには無い番号です。BrickLink の番号としてそのまま送ります' : '番号の形式が違うようです（例: 14417、3070b）'}
            </span>
            {valid && !part && <span className="muted small">写真が出れば番号は合っています。出なくても BrickLink には存在することがあります。</span>}
          </div>
        </div>
      )}

      <div>
        <span className="label">色：{color ? color.name_ja : '指定なし（どの色でもよい）'}</span>
        <div className="swatches">
          <button
            type="button"
            className={`swatch any ${colorId === ANY_COLOR_ID ? 'selected' : ''}`}
            style={{ width: 40, height: 40 }}
            onClick={() => setColorId(ANY_COLOR_ID)}
            aria-pressed={colorId === ANY_COLOR_ID}
            aria-label="色指定なし"
            title="指定なし"
          >
            ?
          </button>
          {catalog.colors.map((c) => (
            <ColorSwatch key={c.id} color={c} selected={c.id === colorId} onClick={() => setColorId(c.id)} size={40} />
          ))}
        </div>
      </div>

      <div className="picker-bottom">
        <QtyStepper value={qty} onChange={setQty} big />
        <button className="btn btn-big btn-kid" disabled={!valid} onClick={add}>
          カートに入れる
        </button>
      </div>
      {added && <p className="ok">{added}</p>}
    </section>
  )
}

function ByList() {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const ok = rows?.filter((r) => !r.error) ?? []
  const bad = rows ? rows.length - ok.length : 0

  function read() {
    setRows(parsePartsList(text, ctx))
    setDone(null)
  }
  function addAll() {
    for (const r of ok) addToCart(rowToCartItem(r))
    setDone(ok.length)
    setRows(null)
    setText('')
  }

  return (
    <section className="stack add-section">
      <label>
        パーツリスト
        <textarea
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setRows(null)
          }}
          placeholder={'1 行に 1 パーツ：番号 色 数量\n14417 黒 4\n3070b Dark Bluish Gray x6\n99780\n\nBrickLink の Wanted List XML や Rebrickable の CSV もそのまま貼れます'}
          spellCheck={false}
        />
      </label>
      <details>
        <summary>対応している書き方</summary>
        <ul className="muted small">
          <li>1 行 1 パーツ：「番号 色 数量」。色は英語名（Black / DBG / Dark Bluish Gray）でも日本語（黒 / 濃いグレー）でもよく、省略すると「指定なし」。数量は「4」「x4」「4個」。省略すると 1</li>
          <li>BrickLink の Wanted List XML（&lt;ITEM&gt;…&lt;/ITEM&gt;）。COLOR は BrickLink の色 ID として読む</li>
          <li>Rebrickable のパーツリスト CSV（Part,Color,Quantity）。Color は Rebrickable の色 ID として読む。列名に BL / BrickLink が入っていれば BrickLink の色 ID</li>
          <li>カタログに無い番号もそのまま通す（BrickLink の番号として送る）。番号が合っているかは BrickLink 側で確認</li>
        </ul>
      </details>
      <button className="btn" onClick={read} disabled={!text.trim()}>
        読み取る
      </button>

      {rows && (
        <>
          <p className="muted">
            {ok.length} 件を読み取りました{bad > 0 && `（${bad} 行は読めず、取り込みません）`}
          </p>
          <ul className="import-rows">
            {rows.map((r, i) => (
              <li key={i} className={`import-row ${r.error ? 'bad' : ''}`}>
                {r.num ? (
                  <PartImage partNum={r.num} colorId={r.color?.id ?? ANY_COLOR_ID} elementId={null} rgb={r.color?.rgb ?? ANY_COLOR_RGB} isTrans={r.color?.is_trans} category={r.part?.category ?? 'basic'} alt={r.num} />
                ) : (
                  <div className="import-noimg">?</div>
                )}
                <div className="cart-info">
                  <strong>{r.part?.name_ja ?? (r.num ? `パーツ ${r.num}` : '読み取れない行')}</strong>
                  <span className="muted">
                    {r.error ? (
                      <em className="warn">{r.error}</em>
                    ) : (
                      <>
                        {r.num}
                        {!r.part && '（カタログ外）'} · {r.color ? r.color.name_ja : r.colorText ? <em className="warn">「{r.colorText}」は色として分からないので指定なし</em> : '色指定なし'}
                      </>
                    )}
                  </span>
                  <span className="muted small">{r.source}</span>
                </div>
                {!r.error && <span className="qty-static">× {r.qty}</span>}
              </li>
            ))}
          </ul>
          <button className="btn btn-big btn-kid" disabled={ok.length === 0} onClick={addAll}>
            {ok.length} 件をカートに入れる
          </button>
        </>
      )}
      {done != null && (
        <p className="ok">
          {done} 件をカートに入れました。<Link to="/kid/cart">カートを見る</Link>
        </p>
      )}
    </section>
  )
}
