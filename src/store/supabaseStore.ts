import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WishRequest } from '../types'
import type { FamilyInfo, RequestStore } from './types'

/**
 * Supabase 実装。
 * 認可は「x-family-code ヘッダ = 行の family_id」を RLS で突き合わせる方式（supabase/migrations 参照）。
 * ファミリーコードを知っている人は誰でも読める、という前提のゆるい保護。中身はレゴの欲しい物リストなので
 * MVP としては許容するが、本格運用なら Supabase Auth に置き換える。
 */
export class SupabaseStore implements RequestStore {
  readonly mode = 'supabase' as const
  private clients = new Map<string, SupabaseClient>()
  private url: string
  private anonKey: string

  constructor(url: string, anonKey: string) {
    this.url = url
    this.anonKey = anonKey
  }

  private client(familyId: string): SupabaseClient {
    let c = this.clients.get(familyId)
    if (!c) {
      c = createClient(this.url, this.anonKey, {
        global: { headers: { 'x-family-code': familyId } },
        auth: { persistSession: false },
      })
      this.clients.set(familyId, c)
    }
    return c
  }

  async list(familyId: string) {
    const { data, error } = await this.client(familyId)
      .from('requests')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as WishRequest[]
  }

  async create(req: WishRequest) {
    const { error } = await this.client(req.family_id).from('requests').insert(req)
    if (error) throw error
    await this.ping(req.family_id)
  }

  async update(familyId: string, id: string, patch: Partial<WishRequest>) {
    const { error } = await this.client(familyId)
      .from('requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('family_id', familyId)
    if (error) throw error
    await this.ping(familyId)
  }

  /**
   * Realtime の postgres_changes はヘッダ方式の RLS を通せないので、
   * Broadcast チャンネルで「変わったよ」を飛ばし、受け手は REST で再取得する。
   */
  private async ping(familyId: string) {
    const ch = this.client(familyId).channel(`family:${familyId}`)
    await new Promise<void>((resolve) => {
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.send({ type: 'broadcast', event: 'changed', payload: {} })
          await ch.unsubscribe()
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve()
        }
      })
    })
  }

  subscribe(familyId: string, onChange: () => void) {
    const ch = this.client(familyId)
      .channel(`family:${familyId}`)
      .on('broadcast', { event: 'changed' }, () => onChange())
      .subscribe()
    // Broadcast が落ちている時の保険として 30 秒ごとに再取得
    const timer = window.setInterval(onChange, 30_000)
    return () => {
      window.clearInterval(timer)
      void ch.unsubscribe()
    }
  }

  async getFamily(code: string) {
    const { data, error } = await this.client(code).from('families').select('code,pin_hash').eq('code', code).maybeSingle()
    if (error) throw error
    return (data as FamilyInfo | null) ?? null
  }

  async ensureFamily(code: string, pinHash: string | null) {
    const cur = await this.getFamily(code)
    if (cur) return cur
    const { error } = await this.client(code).from('families').insert({ code, pin_hash: pinHash })
    if (error) throw error
    return { code, pin_hash: pinHash }
  }

  async setFamilyPin(code: string, pinHash: string) {
    const { error } = await this.client(code).from('families').update({ pin_hash: pinHash }).eq('code', code)
    if (error) throw error
  }

  async savePushSubscription(familyId: string, sub: PushSubscriptionJSON) {
    if (!sub.endpoint) return
    const { error } = await this.client(familyId)
      .from('push_subscriptions')
      .upsert({ family_id: familyId, endpoint: sub.endpoint, keys: sub.keys ?? {} }, { onConflict: 'endpoint' })
    if (error) throw error
  }

  async notifyParent(familyId: string, requestId: string) {
    const { error } = await this.client(familyId).functions.invoke('notify-parent', {
      body: { family_id: familyId, request_id: requestId },
    })
    // 通知失敗はリクエスト作成の失敗にしない（親画面を開けば見える）
    if (error) console.warn('notify-parent failed', error)
  }
}
