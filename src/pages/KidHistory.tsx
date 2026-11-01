import { Link } from 'react-router-dom'
import { PartImage } from '../components/PartImage'
import { StatusBadge } from '../components/StatusBadge'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'

export function KidHistory() {
  const familyId = useFamilyId()
  const { requests, loading } = useRequests(familyId)

  return (
    <main className="page kid">
      <header className="kid-header">
        <Link className="btn btn-ghost" to="/kid">
          ← 戻る
        </Link>
        <h1>リクエスト履歴</h1>
      </header>
      {loading && <p className="muted">読み込み中…</p>}
      {!loading && requests.length === 0 && <p className="empty">まだリクエストはありません</p>}
      <ul className="req-list">
        {requests.map((r) => (
          <li key={r.id} className={`req-card status-${r.status}`}>
            <div className="req-head">
              <StatusBadge status={r.status} />
              <span className="muted">{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
            </div>
            {r.note && <p className="note">「{r.note}」</p>}
            {r.parent_note && <p className="parent-note">💬 {r.parent_note}</p>}
            <div className="thumbs">
              {r.items.slice(0, 8).map((i) => (
                <PartImage key={`${i.part_num}|${i.color_id}`} partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} alt={i.part_name_ja} />
              ))}
              {r.items.length > 8 && <span className="more">+{r.items.length - 8}</span>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
