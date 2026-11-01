import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { hasPush, hasSupabase } from '../lib/config'
import { getPushState, subscribeParentPush, type PushState } from '../lib/push'
import { useFamilyId } from '../store/family'
import { setParentUnlocked } from '../store/settings'
import { useRequests } from '../store/useRequests'

export function Parent() {
  const familyId = useFamilyId()
  const { requests, loading, error, reload } = useRequests(familyId)
  const [push, setPush] = useState<PushState>('disabled')

  useEffect(() => {
    void getPushState().then(setPush)
  }, [])

  const pending = requests.filter((r) => r.status === 'pending')
  const others = requests.filter((r) => r.status !== 'pending')

  return (
    <main className="page parent">
      <header className="parent-header">
        <h1>承認待ち {pending.length > 0 && <span className="count">{pending.length}</span>}</h1>
        <div>
          <button className="btn btn-ghost" onClick={() => void reload()}>
            ↻ 更新
          </button>
          <Link className="btn btn-ghost" to="/parent/settings">
            ⚙️ 設定
          </Link>
          <Link className="btn btn-ghost" to="/kid" onClick={() => setParentUnlocked(false)}>
            🔒 子ども画面へ
          </Link>
        </div>
      </header>

      {hasSupabase && (
        <p className="family-code">
          ファミリーコード <code>{familyId}</code>
          <span className="muted"> — 親スマホの「設定 → 別の端末とつなぐ」でこのコードを入力</span>
        </p>
      )}

      {hasPush && push !== 'subscribed' && (
        <div className="callout">
          {push === 'prompt' && (
            <>
              このスマホに通知を届けるには許可が必要です。
              <button className="btn" onClick={() => familyId && void subscribeParentPush(familyId).then(setPush)}>
                🔔 通知を許可する
              </button>
            </>
          )}
          {push === 'denied' && '通知がブロックされています。ブラウザの設定から許可してください。'}
          {push === 'unsupported' && 'このブラウザは Web Push に対応していません。iPhone はホーム画面に追加（PWA）してから開いてください。'}
        </div>
      )}
      {!hasSupabase && <div className="callout muted">ローカルモード：この端末の「ほしいパーツ」画面から送られたリクエストだけが表示されます。</div>}

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">読み込み中…</p>}

      {pending.length === 0 && !loading && <p className="empty">承認待ちはありません</p>}
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

function RequestRow({ r }: { r: import('../types').WishRequest }) {
  const qty = r.items.reduce((n, i) => n + i.qty, 0)
  return (
    <li className={`req-card status-${r.status}`}>
      <Link to={`/parent/request/${r.id}`} className="req-link">
        <div className="req-head">
          <strong>{new Date(r.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
          <StatusBadge status={r.status} parent />
        </div>
        <div className="muted">
          {r.items.length} 種類 / {qty} 個
        </div>
        {r.note && <p className="note">「{r.note}」</p>}
      </Link>
    </li>
  )
}
