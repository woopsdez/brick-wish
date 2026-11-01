import type { FamilyInfo } from '../store/types'
import type { CartItem, WishRequest } from '../types'

export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

/** ローカル時間での「今月」キー */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 今月すでに使った自動承認枠（承認済み・注文済みの合計、送料別）。親が手動承認した分も枠を消費する */
export function spentThisMonth(requests: WishRequest[], now: Date = new Date()): number {
  const key = monthKey(now)
  return requests
    .filter((r) => (r.status === 'approved' || r.status === 'ordered') && monthKey(new Date(r.created_at)) === key)
    .reduce((n, r) => n + (r.total_yen ?? 0), 0)
}

/** カートの見積もり。価格不明のパーツが 1 つでもあれば total は null */
export function estimateTotal(items: CartItem[]): { total: number | null; unknown: CartItem[] } {
  const unknown = items.filter((i) => i.unit_yen == null)
  if (unknown.length) return { total: null, unknown }
  return { total: items.reduce((n, i) => n + (i.unit_yen ?? 0) * i.qty, 0), unknown }
}

export type ApprovalDecision =
  | { status: 'approved'; approved_by: 'auto'; total_yen: number; remaining: number }
  | { status: 'pending'; approved_by: null; total_yen: number | null; reason: 'off' | 'unknown_price' | 'over_budget'; remaining: number }

/** 送信時にどちらに振り分けるか。人間の判断は「予算超過」か「価格不明」のときだけ */
export function decideApproval(family: FamilyInfo | null, requests: WishRequest[], items: CartItem[], now: Date = new Date()): ApprovalDecision {
  const budget = family?.monthly_budget_yen ?? 0
  const remaining = Math.max(0, budget - spentThisMonth(requests, now))
  const { total, unknown } = estimateTotal(items)
  if (!family?.auto_approve || budget <= 0) return { status: 'pending', approved_by: null, total_yen: total, reason: 'off', remaining }
  if (total == null || unknown.length) return { status: 'pending', approved_by: null, total_yen: null, reason: 'unknown_price', remaining }
  if (total > remaining) return { status: 'pending', approved_by: null, total_yen: total, reason: 'over_budget', remaining }
  return { status: 'approved', approved_by: 'auto', total_yen: total, remaining }
}
