import { useEffect, useState } from 'react'
import type { Role } from '../types'

/** この端末だけに保存する設定（役割・ファミリーコード・名前） */
export interface DeviceSettings {
  role: Role | null
  familyId: string | null
  kidName: string
  /** ローカルモード時の親PIN（SHA-256）。Supabase モードでは families テーブル側を使う */
  localPinHash: string | null
}

const KEY = 'bw:settings:v1'
const DEFAULT: DeviceSettings = { role: null, familyId: null, kidName: '', localPinHash: null }
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

export function useSettings(): DeviceSettings {
  const [s, setS] = useState(loadSettings)
  useEffect(() => {
    const l = () => setS(loadSettings())
    listeners.add(l)
    window.addEventListener('storage', l)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', l)
    }
  }, [])
  return s
}
