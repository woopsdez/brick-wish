import { VAPID_PUBLIC_KEY, hasPush } from './config'
import { getStore } from '../store'

export type PushState = 'unsupported' | 'disabled' | 'denied' | 'prompt' | 'subscribed'

export async function getPushState(): Promise<PushState> {
  if (!hasPush) return 'disabled'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'subscribed' : 'prompt'
}

/** 親スマホで呼ぶ。許可ダイアログ→購読→Supabase に保存 */
export async function subscribeParentPush(familyId: string): Promise<PushState> {
  if (!hasPush || !VAPID_PUBLIC_KEY) return 'disabled'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  await getStore().savePushSubscription(familyId, sub.toJSON())
  return 'subscribed'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
