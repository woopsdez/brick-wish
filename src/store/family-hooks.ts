import { useEffect, useState } from 'react'
import { getStore } from './index'
import { loadSettings } from './settings'
import type { FamilyInfo } from './types'

/**
 * 家族の設定（PIN・月の枠）。変更は saveFamilyBudget 経由で、呼び出し側が reload する。
 * 読むときに無ければ作る（ensureFamily）。ローカルモードで使っていた端末が Supabase モードに切り替わると
 * ファミリー ID だけ手元にあって DB に行が無い状態になるので、その端末の PIN を引き継いで作る。
 */
export function useFamily(familyId: string | null) {
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!familyId) return
    let alive = true
    void getStore()
      .ensureFamily(familyId, loadSettings().localPinHash ?? null)
      .then((f) => {
        if (alive) setFamily(f)
      })
      .catch((e) => console.warn('family load failed', e))
    return () => {
      alive = false
    }
  }, [familyId, tick])
  return { family, reload: () => setTick((t) => t + 1) }
}
