import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ConnectParent } from '../components/ConnectParent'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { mergeItems } from '../lib/bricklink'
import { estimateTotal, requestView, spentThisMonth, yen } from '../lib/budget'
import { cartPermalink, shippingFor } from '../lib/shop'
import { getStore } from '../store'
import { hasPush, hasSupabase } from '../lib/config'
import { getPushState, subscribeParentPush, type PushState } from '../lib/push'
import { useFamily } from '../store/family-hooks'
import { useFamilyId } from '../store/family'
import { setParentUnlocked, useSettings } from '../store/settings'
import { useRequests } from '../store/useRequests'
import type { WishRequest } from '../types'

export function Parent() {
  const familyId = useFamilyId()
  const settings = useSettings()
  const { family } = useFamily(familyId)
  const { requests, loading, error, reload } = useRequests(familyId)
  const [push, setPush] = useState<PushState>('disabled')

  useEffect(() => {
    void getPushState().then(setPush)
  }, [])

  const toPay = requests.filter((r) => requestView(r) === 'approved')
  const pending = requests.filter((r) => requestView(r) === 'pending')
  const nextMonth = requests.filter((r) => requestView(r) === 'next_month')
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
  const [included, setIncluded] = useState<ReadonlySet<string>>(new Set())
  // 支払う分は最初から選び、来月の分は親が選んだものだけ足す。カートに入らない行があるものは詳細画面で個別に扱う
  const selected = [...toPay.filter((r) => !excluded.has(r.id)), ...nextMonth.filter((r) => included.has(r.id))].filter(canBundle)
  const picked = new Set(selected.map((r) => r.id))
  const others = requests.filter((r) => r.status === 'rejected' || r.status === 'ordered')
  const spent = spentThisMonth(requests)
  const open = pending.length + toPay.length
  const pct = family && family.monthly_budget_yen > 0 ? Math.min(100, Math.round((spent / family.monthly_budget_yen) * 100)) : 0

  return (
    <main className="page parent">
      <header className="parent-header">
        <div className="title">
          <span className="eyebrow">Brick Wish</span>
          <h1>
            保護者 {open > 0 && <span className="count">{open}</span>}
          </h1>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => void reload()} aria-label="更新">
            <Icon name="refresh" size={18} />
          </button>
          <Link className="btn btn-ghost" to="/parent/settings" aria-label="設定">
            <Icon name="gear" size={18} />
          </Link>
          <Link className="btn btn-ghost" to="/kid" onClick={() => setParentUnlocked(false)}>
            <Icon name="lock" size={18} />
            子ども画面へ
          </Link>
        </div>
      </header>

      {family && (
        <div className="family-code">
          <div className="budget-row">
            <span>今月の枠（送料別）</span>
            <span className="num">
              {yen(spent)} / {yen(family.monthly_budget_yen)}
            </span>
          </div>
          <div className="budget-bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="row small" style={{ marginTop: 8 }}>
            <Link to="/parent/settings" className="muted small">
              枠を変更
            </Link>
          </div>
        </div>
      )}

      {hasSupabase && familyId && !settings.parentDevice && <ConnectParent familyId={familyId} />}

      {hasPush && push === 'prompt' && (
        <div className="callout">
          {push === 'prompt' && (
            <>
              このスマホに通知を届けるには許可が必要です。
              <button className="btn" onClick={() => familyId && void subscribeParentPush(familyId).then(setPush)}>
                <Icon name="bell" size={18} />
                通知を許可する
              </button>
            </>
          )}
        </div>
      )}
      {!hasSupabase && <div className="callout muted">ローカルモード：この端末の「ほしいパーツ」画面から送られたリクエストだけが表示されます。</div>}

      {error && <p className="error">{error}</p>}
      {loading && <Loading inline />}

      {pending.length > 0 && (
        <>
          <h2>確認が必要 <span className="count">{pending.length}</span></h2>
          <ul className="req-list">
            {pending.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}

      <h2>支払う {toPay.length > 0 && <span className="count">{toPay.length}</span>}</h2>
      {toPay.length === 0 && !loading && <p className="empty small-empty">ありません</p>}
      <ul className="req-list">
        {toPay.map((r) => (
          <RequestRow key={r.id} r={r} picked={picked.has(r.id)} onPick={canBundle(r) ? () => toggle(r.id, excluded, setExcluded) : undefined} />
        ))}
      </ul>

      {nextMonth.length > 0 && (
        <>
          <h2>来月の分</h2>
          <ul className="req-list">
            {nextMonth.map((r) => (
              <RequestRow key={r.id} r={r} picked={picked.has(r.id)} onPick={canBundle(r) ? () => toggle(r.id, included, setIncluded) : undefined} />
            ))}
          </ul>
        </>
      )}

      {familyId && selected.length > 0 && <PayTogether key={selected.map((r) => r.id).join()} selected={selected} onPaid={reload} />}

      {others.length > 0 && (
        <>
          <h2>履歴</h2>
          <ul className="req-list">
            {others.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

function canBundle(r: WishRequest): boolean {
  return cartPermalink(r.items).missing.length === 0
}

function toggle(id: string, cur: ReadonlySet<string>, set: (next: ReadonlySet<string>) => void) {
  const next = new Set(cur)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  set(next)
}

/** 選んだリクエストを 1 つのカートにまとめて支払う。送料も 1 回で済む */
function PayTogether({ selected, onPaid }: { selected: WishRequest[]; onPaid: () => Promise<void> }) {
  const items = mergeItems(selected.flatMap((r) => r.items))
  const { url } = cartPermalink(items)
  const { total } = estimateTotal(items)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function markPaid() {
    setBusy(true)
    setErr(null)
    try {
      for (const r of selected) {
        // 来月の分を一緒に買ったら枠の外。来月の枠は減らさない
        const early = requestView(r) === 'next_month'
        await getStore().update(r.family_id, r.id, early ? { status: 'ordered', approved_by: 'parent', pay_month: null } : { status: 'ordered' })
      }
      await onPaid()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <section className="pay-bar">
      <div className="budget-row">
        <span>
          {selected.length} 件 · {items.length} 種類
        </span>
        {total != null && (
          <strong>
            {yen(total)} + 送料 {yen(shippingFor(total))}
          </strong>
        )}
      </div>
      {err && <p className="error">{err}</p>}
      {url && (
        <a className="btn btn-big" href={url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
          <Icon name="cart" size={18} />
          カートにまとめて入れる
        </a>
      )}
      {opened && (
        <button className="btn" disabled={busy} onClick={() => void markPaid()}>
          <Icon name="box" size={18} />
          支払ったので {selected.length} 件を「注文済み」にする
        </button>
      )}
    </section>
  )
}

function RequestRow({ r, picked, onPick }: { r: WishRequest; picked?: boolean; onPick?: () => void }) {
  const qty = r.items.reduce((n, i) => n + i.qty, 0)
  return (
    <li className={`req-card status-${r.status} ${onPick ? 'pickable' : ''}`}>
      {onPick && (
        <label className="req-pick">
          <input type="checkbox" checked={Boolean(picked)} onChange={onPick} aria-label="まとめて支払いに入れる" />
        </label>
      )}
      <Link to={`/parent/request/${r.id}`} className="req-link">
        <div className="req-head">
          <strong>{r.total_yen != null ? yen(r.total_yen) : '価格不明あり'}</strong>
          <StatusBadge status={requestView(r)} parent />
        </div>
        <div className="muted small">
          {r.items.length} 種類 / {qty} 個 · {new Date(r.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        {r.note && <p className="note">「{r.note}」</p>}
      </Link>
    </li>
  )
}
