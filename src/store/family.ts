import { useEffect, useState } from 'react'
import { familyCode } from '../lib/ids'
import { getStore } from './index'
import { loadSettings, saveSettings, setParentUnlocked, useSettings } from './settings'
import type { FamilyInfo } from './types'

let creating: Promise<string> | null = null
let ensured: string | null = null

/**
 * 端末にファミリーが無ければ黙って作る。初回アクセスで設定画面を出さないため。
 * ファミリー ID が手元にあるときも、ストア側に行が無ければ作る（ローカルモード → Supabase モードへ切り替えた端末）
 */
export async function ensureFamilyId(): Promise<string> {
  const cur = loadSettings().familyId
  if (cur) {
    if (ensured !== cur) {
      ensured = cur
      await getStore()
        .ensureFamily(cur, loadSettings().localPinHash ?? null)
        .catch((e) => console.warn('ensureFamily failed', e))
    }
    return cur
  }
  if (!creating) {
    creating = (async () => {
      const code = familyCode()
      await getStore().ensureFamily(code, null)
      saveSettings({ familyId: code })
      return code
    })()
  }
  return creating
}

export function useFamilyId(): string | null {
  const settings = useSettings()
  const [id, setId] = useState<string | null>(settings.familyId)
  useEffect(() => {
    if (settings.familyId) {
      setId(settings.familyId)
      return
    }
    void ensureFamilyId().then(setId)
  }, [settings.familyId])
  return id
}

/**
 * 別の端末（親スマホ）から既存の家族にコードでつなぐ。PIN は要らない（サーバーの認可はコードだけなので、PIN を求めても安全性は変わらない）。
 * この端末を「親の端末」として記憶し、以後は親画面を PIN なしで開く。
 */
export async function joinFamily(code: string): Promise<FamilyInfo> {
  const fam = await getStore().getFamily(code)
  if (!fam) throw new Error('そのコードの家族は見つかりません')
  saveSettings({ familyId: code, localPinHash: fam.pin_hash ?? null, parentDevice: true })
  setParentUnlocked(true)
  ensured = code
  return fam
}
