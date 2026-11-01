import { useEffect, useState } from 'react'
import { familyCode } from '../lib/ids'
import { getStore } from './index'
import { loadSettings, saveSettings, useSettings } from './settings'

let creating: Promise<string> | null = null

/** 端末にファミリーが無ければ黙って作る。初回アクセスで設定画面を出さないため */
export async function ensureFamilyId(): Promise<string> {
  const cur = loadSettings().familyId
  if (cur) return cur
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
