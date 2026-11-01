import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ConnectParent } from '../components/ConnectParent'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { spentThisMonth, yen } from '../lib/budget'
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

  const toPay = requests.filter((r) => r.status === 'approved')
  const pending = requests.filter((r) => r.status === 'pending')
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
            <span>今月の自動承認枠（送料別）</span>
            <span className="num">
              {yen(spent)} / {yen(family.monthly_budget_yen)}
            </span>
          </div>
          <div className="budget-bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="row small" style={{ marginTop: 8 }}>
            {!family.auto_approve && <span className="muted small">自動承認はオフ</span>}
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

      <h2>支払い待ち {toPay.length > 0 && <span className="count">{toPay.length}</span>}</h2>
      {toPay.length === 0 && !loading && <p className="empty small-empty">ありません</p>}
      <ul className="req-list">
        {toPay.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>

      <h2>承認待ち {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
      {pending.length === 0 && !loading && <p className="empty small-empty">ありません</p>}
      <ul className="req-list">
        {pending.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>

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

function RequestRow({ r }: { r: WishRequest }) {
  const qty = r.items.reduce((n, i) => n + i.qty, 0)
  return (
    <li className={`req-card status-${r.status}`}>
      <Link to={`/parent/request/${r.id}`} className="req-link">
        <div className="req-head">
          <strong>{r.total_yen != null ? yen(r.total_yen) : '価格不明あり'}</strong>
          <StatusBadge status={r.status} parent auto={r.approved_by === 'auto'} />
        </div>
        <div className="muted small">
          {r.items.length} 種類 / {qty} 個 · {new Date(r.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        {r.note && <p className="note">「{r.note}」</p>}
      </Link>
    </li>
  )
}
