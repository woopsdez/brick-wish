import type { WishRequest } from '../types'

export interface FamilyInfo {
  code: string
  pin_hash: string | null
  /** 月の自動承認枠（円、送料別）。0 なら自動承認しない */
  monthly_budget_yen: number
  /** 予算内なら親の承認なしで「承認済み」にする */
  auto_approve: boolean
}

export const DEFAULT_BUDGET_YEN = 1000

/** 子→親のおねがい（リクエスト）を保存・同期する層。ローカル実装と Supabase 実装がある */
export interface RequestStore {
  readonly mode: 'local' | 'supabase'
  list(familyId: string): Promise<WishRequest[]>
  create(req: WishRequest): Promise<void>
  update(familyId: string, id: string, patch: Partial<WishRequest>): Promise<void>
  /** 他端末や他タブからの変更通知。戻り値は解除関数 */
  subscribe(familyId: string, onChange: () => void): () => void

  getFamily(code: string): Promise<FamilyInfo | null>
  /** 存在しなければ作る。存在すればそのまま返す */
  ensureFamily(code: string, pinHash: string | null): Promise<FamilyInfo>
  setFamilyPin(code: string, pinHash: string): Promise<void>
  setFamilyBudget(code: string, monthlyBudgetYen: number, autoApprove: boolean): Promise<void>

  /** 親スマホの Push 購読を保存（Supabase のみ有効） */
  savePushSubscription(familyId: string, sub: PushSubscriptionJSON): Promise<void>
  /** 新規リクエスト作成後に親へ通知（Supabase のみ有効） */
  notifyParent(familyId: string, requestId: string): Promise<void>
}
