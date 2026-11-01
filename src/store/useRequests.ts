import { useCallback, useEffect, useState } from 'react'
import type { WishRequest } from '../types'
import { getStore } from './index'

export function useRequests(familyId: string | null) {
  const [requests, setRequests] = useState<WishRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!familyId) return
    try {
      setRequests(await getStore().list(familyId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [familyId])

  useEffect(() => {
    if (!familyId) return
    void reload()
    return getStore().subscribe(familyId, () => void reload())
  }, [familyId, reload])

  return { requests, loading, error, reload }
}
