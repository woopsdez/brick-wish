import type { FamilyInfo } from '../store/types'
import type { CartItem, RequestStatus, WishRequest } from '../types'

export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

/** ローカル時間での「今月」キー */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nextMonthKey(d: Date = new Date()): string {
  return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

/** 画面で見せる状態。来月に回した分はその月が来るまで next_month、来たら支払う分（approved）になる */
export type RequestView = RequestStatus | 'next_month'

export function requestView(r: WishRequest, now: Date = new Date()): RequestView {
  if (r.status === 'pending' && r.pay_month) return r.pay_month > monthKey(now) ? 'next_month' : 'approved'
  return r.status
}

/** 今月使った枠（送料別）。親が「今払う」にした分は枠の外なので数えない */
export function spentThisMonth(requests: WishRequest[], now: Date = new Date()): number {
  const key = monthKey(now)
  return requests
    .filter((r) => {
      const v = requestView(r, now)
      return (v === 'approved' || v === 'ordered') && r.approved_by !== 'parent' && (r.pay_month ?? monthKey(new Date(r.created_at))) === key
    })
    .reduce((n, r) => n + (r.total_yen ?? 0), 0)
}

/** カートの見積もり。価格不明のパーツが 1 つでもあれば total は null */
export function estimateTotal(items: CartItem[]): { total: number | null; unknown: CartItem[] } {
  const unknown = items.filter((i) => i.unit_yen == null)
  if (unknown.length) return { total: null, unknown }
  return { total: items.reduce((n, i) => n + (i.unit_yen ?? 0) * i.qty, 0), unknown }
}

export interface CartPlan {
  /** 今月の枠で買う行 */
  current: CartItem[]
  /** 子どもが来月に回した行 */
  next: CartItem[]
  /** 価格が分からず親の確認に回る行 */
  unknown: CartItem[]
  currentTotal: number
  nextTotal: number
  budget: number
  remaining: number
  /** 今月の枠を超えている額。0 より大きい間は送れない */
  over: number
}

/** カートを今月の分・来月の分・価格未確認に分ける */
export function planCart(family: FamilyInfo | null, requests: WishRequest[], items: CartItem[], now: Date = new Date()): CartPlan {
  const budget = family?.monthly_budget_yen ?? 0
  const remaining = Math.max(0, budget - spentThisMonth(requests, now))
  const unknown = items.filter((i) => i.unit_yen == null)
  const known = items.filter((i) => i.unit_yen != null)
  const current = known.filter((i) => !i.next_month)
  const next = known.filter((i) => i.next_month)
  const sum = (xs: CartItem[]) => xs.reduce((n, i) => n + (i.unit_yen ?? 0) * i.qty, 0)
  const currentTotal = sum(current)
  return { current, next, unknown, currentTotal, nextTotal: sum(next), budget, remaining, over: Math.max(0, currentTotal - remaining) }
}
