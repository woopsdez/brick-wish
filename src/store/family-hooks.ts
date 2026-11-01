import { useEffect, useState } from 'react'
import { getStore } from './index'
import type { FamilyInfo } from './types'

/** 家族の設定（PIN・月予算・自動承認）。変更は saveFamilyBudget 経由で、呼び出し側が reload する */
export function useFamily(familyId: string | null) {
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!familyId) return
    let alive = true
    void getStore()
      .getFamily(familyId)
      .then((f) => {
        if (alive) setFamily(f)
      })
    return () => {
      alive = false
    }
  }, [familyId, tick])
  return { family, reload: () => setTick((t) => t + 1) }
}
