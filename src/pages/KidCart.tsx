import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { decideApproval, estimateTotal, yen } from '../lib/budget'
import { uuid } from '../lib/ids'
import { SHOP, cartPermalink } from '../lib/shop'
import { getStore } from '../store'
import { clearCart, setCartQty, useCart } from '../store/cart'
import { useFamily } from '../store/family-hooks'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'
import type { WishRequest } from '../types'

export function KidCart() {
  const cart = useCart()
  const familyId = useFamilyId()
  const { family } = useFamily(familyId)
  const { requests } = useRequests(familyId)
  const nav = useNavigate()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const total = cart.reduce((n, i) => n + i.qty, 0)
  const { total: subtotal } = useMemo(() => estimateTotal(cart), [cart])
  const decision = useMemo(() => decideApproval(family, requests, cart), [family, requests, cart])

  async function send() {
    if (!familyId || cart.length === 0) return
    setBusy(true)
    setErr(null)
    try {
      // 送信直前に最新の予算・履歴で判定し直す（別端末で承認済みが増えている可能性）
      const fam = await getStore().getFamily(familyId)
      const all = await getStore().list(familyId)
      const d = decideApproval(fam, all, cart)
      const now = new Date().toISOString()
      const req: WishRequest = {
        id: uuid(),
        family_id: familyId,
        kid_name: '',
        note: note.trim(),
        items: cart,
        status: d.status,
        approved_by: d.approved_by,
        total_yen: d.total_yen,
        // サンプル価格のときは variant id が偽物なので URL を持たせない
        cart_url: SHOP.sample ? null : cartPermalink(cart).url,
        parent_note: '',
        created_at: now,
        updated_at: now,
      }
      await getStore().create(req)
      await getStore().notifyParent(req.family_id, req.id)
      clearCart()
      nav('/kid/sent', { replace: true, state: { auto: d.status === 'approved', total: d.total_yen } })
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
                  <span className="dot" style={{ background: `#${i.color_rgb}` }} /> {i.color_name}
                  {' · '}
                  {i.unit_yen != null ? `${yen(i.unit_yen)} × ${i.qty} = ${yen(i.unit_yen * i.qty)}` : <em className="warn">在庫なし</em>}
                </span>
              </div>
              <QtyStepper value={i.qty} onChange={(n) => setCartQty(i, n)} min={0} />
            </li>
          ))}
        </ul>
      )}

      {cart.length > 0 && (
        <div className="stack">
          <section className={`budget-box ${decision.status === 'approved' ? 'ok' : 'needs-parent'}`}>
            <div className="budget-row">
              <span>小計（送料別）</span>
              <strong>{subtotal != null ? yen(subtotal) : '価格不明あり'}</strong>
            </div>
            {family && family.auto_approve && family.monthly_budget_yen > 0 && (
              <div className="budget-row muted">
                <span>今月の自動承認枠の残り</span>
                <span>
                  {yen(decision.remaining)} / {yen(family.monthly_budget_yen)}
                </span>
              </div>
            )}
            <p className="budget-verdict">
              {decision.status === 'approved' && '✅ 枠内なので、送るとすぐ OK になります。保護者は支払いだけ'}
              {decision.status === 'pending' && decision.reason === 'over_budget' && `⚠ 今月の枠を ${yen((decision.total_yen ?? 0) - decision.remaining)} 超えるので、保護者の承認が必要です`}
              {decision.status === 'pending' && decision.reason === 'unknown_price' && `⚠ ${SHOP.name}に在庫がないパーツがあるので、保護者の確認が必要です`}
              {decision.status === 'pending' && decision.reason === 'off' && '保護者の承認が必要です'}
            </p>
          </section>
          <label>
            メモ（何を作る？）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 変形するロボットを作りたい" rows={2} />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-big btn-kid" onClick={() => void send()} disabled={busy}>
            {decision.status === 'approved' ? 'OK にして注文へ進める' : '保護者にリクエストを送る'}
          </button>
        </div>
      )}
    </main>
  )
}

export function KidSent() {
  const { state } = useLocation() as { state?: { auto?: boolean; total?: number | null } }
  const auto = Boolean(state?.auto)
  return (
    <main className="page kid center">
      <div className="big-emoji">{auto ? '✅' : '📨'}</div>
      <h1>{auto ? 'OK！注文に進みます' : 'リクエストを送りました'}</h1>
      <p>
        {auto
          ? `今月の枠内（${state?.total != null ? yen(state.total) : ''}）なので承認は不要です。保護者が支払うと届きます。`
          : '保護者が確認したら、履歴に結果が表示されます。'}
      </p>
      <Link className="btn btn-big btn-kid" to="/kid">
        パーツを探す
      </Link>
      <Link className="btn btn-ghost" to="/kid/history">
        履歴を見る
      </Link>
    </main>
  )
}
