import type { RequestView } from '../lib/budget'

export const STATUS_LABEL: Record<RequestView, string> = {
  pending: '確認中',
  approved: 'OK',
  next_month: '来月',
  rejected: '今回は見送り',
  ordered: '注文済み',
}

export const STATUS_LABEL_PARENT: Record<RequestView, string> = {
  pending: '確認',
  approved: '未払い',
  next_month: '来月の分',
  rejected: '見送り',
  ordered: '注文済み',
}

export function StatusBadge({ status, parent }: { status: RequestView; parent?: boolean }) {
  return <span className={`badge badge-${status}`}>{parent ? STATUS_LABEL_PARENT[status] : STATUS_LABEL[status]}</span>
}
