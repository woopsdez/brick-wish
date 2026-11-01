import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { KidNav } from '../components/KidNav'
import { Loading } from '../components/Loading'
import { PartImage } from '../components/PartImage'
import { StatusBadge } from '../components/StatusBadge'
import { requestView, yen } from '../lib/budget'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'

export function KidHistory() {
  const familyId = useFamilyId()
  const { requests, loading } = useRequests(familyId)

  return (
    <main className="page kid">
      <header className="kid-header">
        <div className="title">
          <span className="eyebrow">Brick Wish</span>
          <h1>リクエスト履歴</h1>
        </div>
        <Link className="btn btn-ghost back" to="/kid">
          <Icon name="back" size={18} />
          パーツ一覧
        </Link>
      </header>
      {loading && <Loading />}
      {!loading && requests.length === 0 && <p className="empty">まだリクエストはありません</p>}
      <ul className="req-list">
        {requests.map((r) => (
          <li key={r.id} className={`req-card status-${r.status}`}>
            <div className="req-head">
              <StatusBadge status={requestView(r)} />
              <span className="muted small">
                {r.total_yen != null && (
                  <>
                    <span className="num">{yen(r.total_yen)}</span> ·{' '}
                  </>
                )}
                {new Date(r.created_at).toLocaleDateString('ja-JP')}
              </span>
            </div>
            {r.note && <p className="note">「{r.note}」</p>}
            {r.parent_note && <p className="parent-note">保護者から：{r.parent_note}</p>}
            <div className="thumbs">
              {r.items.slice(0, 8).map((i) => (
                <PartImage key={`${i.part_num}|${i.color_id}`} partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} category={i.category} alt={i.part_name_ja} />
              ))}
              {r.items.length > 8 && <span className="more">+{r.items.length - 8}</span>}
            </div>
          </li>
        ))}
      </ul>
      <KidNav />
    </main>
  )
}
