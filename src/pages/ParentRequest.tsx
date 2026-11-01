import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { StatusBadge } from '../components/StatusBadge'
import { buildPickABrickCsv, buildWantedListXml, downloadText, mergeItems } from '../lib/bricklink'
import { BRICKLINK_WANTED_LIST_URL, BRICKLINK_WANTED_UPLOAD_URL } from '../lib/config'
import { getStore } from '../store'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'
import type { CartItem, WishRequest } from '../types'

export function ParentRequest() {
  const { id } = useParams()
  const familyId = useFamilyId()
  const { requests, loading } = useRequests(familyId)
  const req = requests.find((r) => r.id === id)

  if (loading && !req) return <main className="page parent">読み込み中…</main>
  if (!req) return <main className="page parent">見つかりません。<Link to="/parent">一覧へ</Link></main>
  return <Detail key={req.id + req.updated_at} req={req} />
}

function Detail({ req }: { req: WishRequest }) {
  const nav = useNavigate()
  const [items, setItems] = useState<CartItem[]>(() => mergeItems(req.items))
  const [parentNote, setParentNote] = useState(req.parent_note)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const xml = useMemo(() => buildWantedListXml(items, { condition: null }), [items])
  const totalQty = items.reduce((n, i) => n + i.qty, 0)
  const missingColor = items.filter((i) => i.bl_color_id == null)
  const editable = req.status === 'pending'

  async function decide(status: 'approved' | 'rejected') {
    setBusy(true)
    setErr(null)
    try {
      await getStore().update(req.family_id, req.id, { status, items, parent_note: parentNote.trim() })
      if (status === 'rejected') nav('/parent')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function markOrdered() {
    setBusy(true)
    try {
      await getStore().update(req.family_id, req.id, { status: 'ordered' })
      nav('/parent')
    } finally {
      setBusy(false)
    }
  }

  function setQty(it: CartItem, qty: number) {
    setItems((cur) => (qty <= 0 ? cur.filter((x) => x !== it) : cur.map((x) => (x === it ? { ...x, qty } : x))))
  }

  async function copyXml() {
    await navigator.clipboard.writeText(xml)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="page parent">
      <header className="parent-header">
        <Link className="btn btn-ghost" to="/parent">
          ← 一覧
        </Link>
        <StatusBadge status={req.status} parent />
      </header>

      <h1>
        リクエスト <span className="muted">({new Date(req.created_at).toLocaleString('ja-JP')})</span>
      </h1>
      {req.note && <p className="note">「{req.note}」</p>}

      <ul className="cart-list">
        {items.map((i) => (
          <li key={`${i.part_num}|${i.color_id}`} className="cart-row">
            <PartImage partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} alt={i.part_name_ja} />
            <div className="cart-info">
              <strong>{i.part_name_ja}</strong>
              <span className="muted">
                {i.part_name} · BL {i.bl_id} · <span className="dot" style={{ background: `#${i.color_rgb}` }} /> {i.color_name}
                {i.bl_color_id == null && <em className="warn"> 色ID不明</em>}
              </span>
            </div>
            {editable ? <QtyStepper value={i.qty} onChange={(n) => setQty(i, n)} min={0} /> : <span className="qty-static">× {i.qty}</span>}
          </li>
        ))}
      </ul>
      <p className="muted">
        {items.length} 種類 / {totalQty} 個
      </p>

      {editable && (
        <section className="decide">
          <label>
            子どもへのメッセージ（任意）
            <input value={parentNote} onChange={(e) => setParentNote(e.target.value)} placeholder="例: 赤いのは今あるやつ使おう" />
          </label>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn btn-big" disabled={busy || items.length === 0} onClick={() => void decide('approved')}>
              ✅ 承認して注文へ
            </button>
            <button className="btn btn-big btn-danger" disabled={busy} onClick={() => void decide('rejected')}>
              今回は見送り
            </button>
          </div>
        </section>
      )}

      {(req.status === 'approved' || req.status === 'ordered') && (
        <section className="order">
          <h2>BrickLink で注文する</h2>
          {missingColor.length > 0 && (
            <p className="callout">
              {missingColor.length} 件は BrickLink の色 ID が未登録のため「色指定なし」で出力されます。scripts/build-catalog.mjs を API キー付きで実行すると解消します。
            </p>
          )}
          <ol className="steps">
            <li>
              <button className="btn" onClick={() => downloadText(`brick-wish-${req.id.slice(0, 8)}.xml`, xml, 'application/xml')}>
                ⬇️ Wanted List XML をダウンロード
              </button>
              <button className="btn btn-ghost" onClick={() => void copyXml()}>
                {copied ? '✅ コピーした' : '📋 XML をコピー'}
              </button>
            </li>
            <li>
              <a className="btn" href={BRICKLINK_WANTED_UPLOAD_URL} target="_blank" rel="noopener noreferrer">
                🔗 BrickLink のアップロード画面を開く
              </a>
              <span className="muted"> → 「Upload」タブで XML を貼り付け（またはファイル選択）し、新しい Wanted List として保存</span>
            </li>
            <li>
              <a className="btn btn-ghost" href={BRICKLINK_WANTED_LIST_URL} target="_blank" rel="noopener noreferrer">
                Wanted List 一覧
              </a>
              <span className="muted"> → 作ったリストの「Buy All」で店舗を自動選択し、カートへ。決済は BrickLink 上で行います</span>
            </li>
          </ol>
          <details>
            <summary>XML を表示</summary>
            <pre className="xml">{xml}</pre>
          </details>
          <details>
            <summary>LEGO Pick a Brick 用 CSV（element ID があるパーツのみ）</summary>
            <PabExport items={items} id={req.id} />
          </details>
          {req.status === 'approved' && (
            <button className="btn btn-big" disabled={busy} onClick={() => void markOrdered()}>
              📦 注文したことにする
            </button>
          )}
        </section>
      )}
    </main>
  )
}

function PabExport({ items, id }: { items: CartItem[]; id: string }) {
  const { csv, skipped } = buildPickABrickCsv(items)
  const ok = items.length - skipped.length
  return (
    <div className="stack">
      <p className="muted">
        出力可能 {ok} 件 / 除外 {skipped.length} 件（element ID 未登録）。Pick a Brick のリストアップロード対応地域は公式ページで確認してください。
      </p>
      <button className="btn btn-ghost" disabled={ok === 0} onClick={() => downloadText(`pick-a-brick-${id.slice(0, 8)}.csv`, csv, 'text/csv')}>
        ⬇️ CSV をダウンロード
      </button>
    </div>
  )
}
