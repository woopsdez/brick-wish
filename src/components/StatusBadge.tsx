import type { RequestStatus } from '../types'

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'まち',
  approved: 'OK！',
  rejected: 'こんどね',
  ordered: 'ちゅうもんした',
}

export const STATUS_LABEL_PARENT: Record<RequestStatus, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '見送り',
  ordered: '注文済み',
}

export function StatusBadge({ status, parent }: { status: RequestStatus; parent?: boolean }) {
  return <span className={`badge badge-${status}`}>{parent ? STATUS_LABEL_PARENT[status] : STATUS_LABEL[status]}</span>
}
