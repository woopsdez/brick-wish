import { useEffect, useState } from 'react'

/** この端末だけに保存する設定 */
export interface DeviceSettings {
  familyId: string | null
  /** ローカルモード時の親PIN（SHA-256）。Supabase モードでは families テーブル側を使う */
  localPinHash: string | null
}

const KEY = 'bw:settings:v2'
const UNLOCK_KEY = 'bw:parent-unlocked'
const DEFAULT: DeviceSettings = { familyId: null, localPinHash: null }
const listeners = new Set<() => void>()

export function loadSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function saveSettings(patch: Partial<DeviceSettings>) {
  const next = { ...loadSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

/** 親画面のロック解除はタブ（セッション）単位。アプリを閉じると再びロックされる */
export function isParentUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function setParentUnlocked(v: boolean) {
  try {
    if (v) sessionStorage.setItem(UNLOCK_KEY, '1')
    else sessionStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useSettings(): DeviceSettings & { parentUnlocked: boolean } {
  const [s, setS] = useState(() => ({ ...loadSettings(), parentUnlocked: isParentUnlocked() }))
  useEffect(() => {
    const l = () => setS({ ...loadSettings(), parentUnlocked: isParentUnlocked() })
    listeners.add(l)
    window.addEventListener('storage', l)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', l)
    }
  }, [])
  return s
}
