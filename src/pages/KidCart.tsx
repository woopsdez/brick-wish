import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { uuid } from '../lib/ids'
import { getStore } from '../store'
import { clearCart, setCartQty, useCart } from '../store/cart'
import { useFamilyId } from '../store/family'
import type { WishRequest } from '../types'

export function KidCart() {
  const cart = useCart()
  const familyId = useFamilyId()
  const nav = useNavigate()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const total = cart.reduce((n, i) => n + i.qty, 0)

  async function send() {
    if (!familyId || cart.length === 0) return
    setBusy(true)
    setErr(null)
    const now = new Date().toISOString()
    const req: WishRequest = {
      id: uuid(),
      family_id: familyId,
      kid_name: '',
      note: note.trim(),
      items: cart,
      status: 'pending',
      parent_note: '',
      created_at: now,
      updated_at: now,
    }
    try {
      await getStore().create(req)
      await getStore().notifyParent(req.family_id, req.id)
      clearCart()
      nav('/kid/sent', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page kid">
      <header className="kid-header">
        <Link className="btn btn-ghost" to="/kid">
          ← 戻る
        </Link>
        <h1>カート（{total} 個）</h1>
      </header>

      {cart.length === 0 ? (
        <p className="empty">カートは空です。<Link to="/kid">パーツを探す</Link></p>
      ) : (
        <ul className="cart-list">
          {cart.map((i) => (
            <li key={`${i.part_num}|${i.color_id}`} className="cart-row">
              <PartImage partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} category={i.category} alt={i.part_name_ja} />
              <div className="cart-info">
                <strong>{i.part_name_ja}</strong>
                <span className="muted">
                  {i.bl_id} · <span className="dot" style={{ background: `#${i.color_rgb}` }} /> {i.color_name}
                </span>
              </div>
              <QtyStepper value={i.qty} onChange={(n) => setCartQty(i, n)} min={0} />
            </li>
          ))}
        </ul>
      )}

      {cart.length > 0 && (
        <div className="stack">
          <label>
            メモ（何を作る？）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 変形するロボットを作りたい" rows={2} />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-big btn-kid" onClick={() => void send()} disabled={busy}>
            保護者にリクエストを送る
          </button>
        </div>
      )}
    </main>
  )
}

export function KidSent() {
  return (
    <main className="page kid center">
      <div className="big-emoji">📨</div>
      <h1>リクエストを送りました</h1>
      <p>保護者が確認したら、履歴に結果が表示されます。</p>
      <Link className="btn btn-big btn-kid" to="/kid">
        パーツを探す
      </Link>
      <Link className="btn btn-ghost" to="/kid/history">
        リクエスト履歴を見る
      </Link>
    </main>
  )
}
