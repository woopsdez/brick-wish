import { hasSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/config'
import { LocalStore } from './localStore'
import { SupabaseStore } from './supabaseStore'
import type { RequestStore } from './types'

let instance: RequestStore | null = null

export function getStore(): RequestStore {
  if (!instance) {
    instance = hasSupabase ? new SupabaseStore(SUPABASE_URL!, SUPABASE_ANON_KEY!) : new LocalStore()
  }
  return instance
}

export type { RequestStore } from './types'
