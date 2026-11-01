import type { WishRequest } from '../types'

export interface FamilyInfo {
  code: string
  pin_hash: string | null
}

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

  /** 親スマホの Push 購読を保存（Supabase のみ有効） */
  savePushSubscription(familyId: string, sub: PushSubscriptionJSON): Promise<void>
  /** 新規リクエスト作成後に親へ通知（Supabase のみ有効） */
  notifyParent(familyId: string, requestId: string): Promise<void>
}
