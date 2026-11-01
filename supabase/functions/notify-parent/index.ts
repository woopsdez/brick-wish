// Supabase Edge Function: 新しいおねがいが来たら親スマホに Web Push を送る
// 呼び出し: supabase.functions.invoke('notify-parent', { body: { family_id, request_id } })
// 必要な secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:...), APP_URL(例 https://user.github.io/brick-wish/)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で注入する。
//
// ⚠ この関数はこの開発環境から Supabase に接続できなかったため未デプロイ・未実行。
//   `supabase functions serve` でローカル検証してからデプロイすること。
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-family-code',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
  const appUrl = Deno.env.get('APP_URL') ?? './'
  if (!vapidPublic || !vapidPrivate) return json({ error: 'VAPID keys not configured' }, 500)
  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate)

  let body: { family_id?: string; request_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const familyCode = req.headers.get('x-family-code')
  if (!body.family_id || !body.request_id || familyCode !== body.family_id) return json({ error: 'bad request' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // リクエストが本当に存在し、その家族のものであることを確認（コードを知らない人は呼べない）
  const { data: reqRow, error: reqErr } = await admin
    .from('requests')
    .select('id, kid_name, note, items')
    .eq('id', body.request_id)
    .eq('family_id', body.family_id)
    .maybeSingle()
  if (reqErr || !reqRow) return json({ error: 'request not found' }, 404)

  const { data: subs, error: subErr } = await admin.from('push_subscriptions').select('id, endpoint, keys').eq('family_id', body.family_id)
  if (subErr) return json({ error: subErr.message }, 500)

  const items = (reqRow.items as Array<{ qty: number }>) ?? []
  const qty = items.reduce((n, i) => n + (i.qty ?? 0), 0)
  const payload = JSON.stringify({
    title: '新しいリクエスト',
    body: `${items.length} 種類 / ${qty} 個${reqRow.note ? ` 「${reqRow.note}」` : ''}`,
    url: `${appUrl}#/parent/request/${reqRow.id}`,
    tag: `req-${reqRow.id}`,
  })

  let sent = 0
  const stale: string[] = []
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, payload, { TTL: 60 * 60 * 24 })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) stale.push(s.id)
        else console.error('push failed', s.endpoint, e)
      }
    }),
  )
  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale)

  return json({ sent, removed: stale.length })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
