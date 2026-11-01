import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { KidNav } from '../components/KidNav'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { monthKey, nextMonthKey, planCart, yen } from '../lib/budget'
import { uuid } from '../lib/ids'
import { SHOP, cartPermalink, priceStatus } from '../lib/shop'
import { getStore } from '../store'
import { cartKey, removeFromCart, setCartNextMonth, setCartQty, useCart } from '../store/cart'
import { useFamily } from '../store/family-hooks'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'
import type { CartItem, WishRequest } from '../types'

function CartLine({ item, canDefer }: { item: CartItem; canDefer: boolean }) {
  const i = item
  return (
    <li className={`cart-row ${i.next_month ? 'is-next-month' : ''}`}>
      <PartImage partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} category={i.category} alt={i.part_name_ja} />
      <div className="cart-info">
        <strong>{i.part_name_ja}</strong>
        <span className="muted">
          <span className="dot" style={{ background: `#${i.color_rgb}` }} /> {i.color_name}
          {' · '}
          {i.unit_yen != null ? `${yen(i.unit_yen)} × ${i.qty} = ${yen(i.unit_yen * i.qty)}` : priceStatus(i.part_num, i.color_id) === 'soldout' ? <em className="warn">在庫なし · 保護者が確認</em> : '価格は保護者が確認'}
        </span>
        {canDefer && (
          <button type="button" className="line-action" onClick={() => setCartNextMonth(i, !i.next_month)}>
            {i.next_month ? '今月に戻す' : '来月に回す'}
          </button>
        )}
      </div>
      <QtyStepper value={i.qty} onChange={(n) => setCartQty(i, n)} min={0} />
    </li>
  )
}

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
  const plan = useMemo(() => planCart(family, requests, cart), [family, requests, cart])

  async function send() {
    if (!familyId || cart.length === 0) return
    setBusy(true)
    setErr(null)
    try {
      // 送信直前に最新の枠で確かめる（別の端末で使っている可能性）
      const fam = await getStore().getFamily(familyId)
      const all = await getStore().list(familyId)
      const p = planCart(fam, all, cart)
      if (p.over > 0) {
        setErr(`今月の枠が変わりました。あと ${yen(p.remaining)} です`)
        return
      }
      const now = new Date().toISOString()
      const toRequest = (lines: CartItem[], fields: Pick<WishRequest, 'status' | 'approved_by' | 'total_yen' | 'pay_month'>): WishRequest => {
        const items = lines.map(({ next_month: _omit, ...rest }) => rest)
        return {
          id: uuid(),
          family_id: familyId,
          kid_name: '',
          note: note.trim(),
          items,
          // サンプル価格のときは variant id が偽物なので URL を持たせない
          cart_url: SHOP.sample ? null : cartPermalink(items).url,
          parent_note: '',
          created_at: now,
          updated_at: now,
          ...fields,
        }
      }
      // 親が今すぐ動く分だけ通知する。来月の分は通知しない
      const batches = [
        { lines: p.current, notify: true, fields: { status: 'approved', approved_by: 'auto', total_yen: p.currentTotal, pay_month: monthKey() } as const },
        { lines: p.unknown, notify: true, fields: { status: 'pending', approved_by: null, total_yen: null, pay_month: null } as const },
        { lines: p.next, notify: false, fields: { status: 'pending', approved_by: null, total_yen: p.nextTotal, pay_month: nextMonthKey() } as const },
      ]
      for (const b of batches) {
        if (b.lines.length === 0) continue
        const req = toRequest(b.lines, b.fields)
        await getStore().create(req)
        // 途中で失敗しても、送れた行を送り直さない
        removeFromCart(b.lines)
        if (b.notify) await getStore().notifyParent(req.family_id, req.id)
      }
      nav('/kid/sent', { replace: true, state: { current: p.current.length ? p.currentTotal : null, next: p.next.length ? p.nextTotal : null, unknown: p.unknown.length } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page kid">
      <header className="kid-header">
        <div className="title">
          <span className="eyebrow">Brick Wish</span>
          <h1>カート（{total} 個）</h1>
        </div>
        <Link className="btn btn-ghost back" to="/kid">
          <Icon name="back" size={18} />
          パーツ一覧
        </Link>
      </header>

      {cart.length === 0 ? (
        <p className="empty">カートは空です。<Link to="/kid">パーツを探す</Link></p>
      ) : (
        <ul className="cart-list">
          {[...plan.current, ...plan.unknown, ...plan.next].map((i) => (
            <CartLine key={cartKey(i)} item={i} canDefer={i.unit_yen != null} />
          ))}
        </ul>
      )}

      {cart.length > 0 && (
        <div className="stack">
          <section className={`budget-box ${plan.over > 0 ? 'needs-parent' : 'ok'}`}>
            <div className="budget-row">
              <span>今月の分（送料別）</span>
              <strong>{yen(plan.currentTotal)}</strong>
            </div>
            <div className="budget-row muted">
              <span>今月の枠の残り</span>
              <span className="num">
                {yen(plan.remaining)} / {yen(plan.budget)}
              </span>
            </div>
            {plan.next.length > 0 && (
              <div className="budget-row muted">
                <span>来月の分</span>
                <span className="num">{yen(plan.nextTotal)}</span>
              </div>
            )}
            {plan.over > 0 && <p className="budget-verdict">{yen(plan.over)} オーバーです。「来月に回す」か、個数を減らしてください</p>}
            {plan.unknown.length > 0 && <p className="muted small">価格がわからないパーツは保護者が確認します</p>}
          </section>
          <label>
            メモ（何を作る？）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 変形するロボットを作りたい" rows={2} />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-big btn-kid" onClick={() => void send()} disabled={busy || plan.over > 0}>
            送る
          </button>
        </div>
      )}
      <KidNav />
    </main>
  )
}

export function KidSent() {
  const { state } = useLocation() as { state?: { current?: number | null; next?: number | null; unknown?: number } }
  return (
    <main className="page kid center">
      <div className="sent-mark" aria-hidden="true">
        <Icon name="check" size={32} />
      </div>
      <h1>送りました</h1>
      {state?.current != null && <p>今月の分 {yen(state.current)}。保護者が支払うと届きます。</p>}
      {state?.next != null && <p>来月の分 {yen(state.next)}。来月になったら保護者が支払います。</p>}
      {(state?.unknown ?? 0) > 0 && <p>価格がわからないパーツは、保護者が確認します。</p>}
      <Link className="btn btn-big btn-kid" to="/kid">
        パーツを探す
      </Link>
      <Link className="btn btn-ghost" to="/kid/history">
        履歴を見る
      </Link>
      <KidNav />
    </main>
  )
}
