import type { RequestStatus } from '../types'

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '確認待ち',
  approved: 'OK',
  rejected: '今回は見送り',
  ordered: '注文済み',
}

export const STATUS_LABEL_PARENT: Record<RequestStatus, string> = {
  pending: '承認待ち',
  approved: '支払い待ち',
  rejected: '見送り',
  ordered: '注文済み',
}

export function StatusBadge({ status, parent, auto }: { status: RequestStatus; parent?: boolean; auto?: boolean }) {
  let label = parent ? STATUS_LABEL_PARENT[status] : STATUS_LABEL[status]
  if (status === 'approved' && auto) label = parent ? '自動承認・支払い待ち' : '自動 OK'
  return <span className={`badge badge-${status}`}>{label}</span>
}
