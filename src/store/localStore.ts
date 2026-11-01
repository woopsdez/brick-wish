import type { WishRequest } from '../types'
import { DEFAULT_BUDGET_YEN, type FamilyInfo, type RequestStore } from './types'

const reqKey = (f: string) => `bw:requests:${f}`
const famKey = (f: string) => `bw:family:${f}`
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bw:requests') : null
/** 同じタブ内の購読者。storage イベントも BroadcastChannel も自分自身には届かないため */
const localListeners = new Set<(key: string) => void>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
  channel?.postMessage({ key })
  localListeners.forEach((l) => l(key))
}

/** 旧バージョンで保存した家族情報（予算フィールド無し）にも既定値を補う */
function withDefaults(code: string, fam: Partial<FamilyInfo>): FamilyInfo {
  return {
    code,
    pin_hash: fam.pin_hash ?? null,
    monthly_budget_yen: fam.monthly_budget_yen ?? DEFAULT_BUDGET_YEN,
    auto_approve: fam.auto_approve ?? true,
  }
}

/** 同一端末内（タブレット 1 台で子→親）向け。localStorage + BroadcastChannel */
export class LocalStore implements RequestStore {
  readonly mode = 'local' as const

  async list(familyId: string) {
    return read<WishRequest[]>(reqKey(familyId), []).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  async create(req: WishRequest) {
    const all = read<WishRequest[]>(reqKey(req.family_id), [])
    all.push(req)
    write(reqKey(req.family_id), all)
  }

  async update(familyId: string, id: string, patch: Partial<WishRequest>) {
    const all = read<WishRequest[]>(reqKey(familyId), [])
    const i = all.findIndex((r) => r.id === id)
    if (i < 0) throw new Error('request not found')
    all[i] = { ...all[i], ...patch, updated_at: new Date().toISOString() }
    write(reqKey(familyId), all)
  }

  subscribe(familyId: string, onChange: () => void) {
    const key = reqKey(familyId)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) onChange()
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data?.key === key) onChange()
    }
    const onLocal = (k: string) => {
      if (k === key) onChange()
    }
    window.addEventListener('storage', onStorage)
    channel?.addEventListener('message', onMsg)
    localListeners.add(onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      channel?.removeEventListener('message', onMsg)
      localListeners.delete(onLocal)
    }
  }

  async getFamily(code: string) {
    const fam = read<Partial<FamilyInfo> | null>(famKey(code), null)
    return fam ? withDefaults(code, fam) : null
  }

  async ensureFamily(code: string, pinHash: string | null) {
    const cur = await this.getFamily(code)
    if (cur) return cur
    const fam = withDefaults(code, { pin_hash: pinHash })
    write(famKey(code), fam)
    return fam
  }

  async setFamilyPin(code: string, pinHash: string) {
    const fam = (await this.getFamily(code)) ?? withDefaults(code, {})
    write(famKey(code), { ...fam, pin_hash: pinHash })
  }

  async setFamilyBudget(code: string, monthlyBudgetYen: number, autoApprove: boolean) {
    const fam = (await this.getFamily(code)) ?? withDefaults(code, {})
    write(famKey(code), { ...fam, monthly_budget_yen: monthlyBudgetYen, auto_approve: autoApprove })
  }

  async savePushSubscription() {
    /* ローカルモードでは通知先が同じ端末なので何もしない */
  }

  async notifyParent() {
    /* 同上 */
  }
}
