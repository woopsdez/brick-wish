#!/usr/bin/env node
/**
 * E2E 用の Supabase スタブ。アプリは本物の supabase-js のまま、接続先だけをここに向ける。本番の家族データには触らない。
 * Docker なしで動かすために、アプリが使う範囲だけを本物に合わせて実装している。
 *  - REST（PostgREST）: families / requests の読み書き。x-family-code による RLS も再現する
 *  - Realtime（Phoenix プロトコル vsn 2.0.0）: Broadcast。**送信者本人には配信しない**（Supabase の既定 self: false）
 *  - Edge Function: notify-parent は呼ばれた回数だけ記録する
 * テスト用の窓口: GET /__test/family/<コード> で、保存された行と通知の回数を返す
 */
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.STUB_PORT ?? 54399)

const COLUMNS = {
  families: ['code', 'pin_hash', 'monthly_budget_yen', 'auto_approve', 'created_at'],
  requests: ['id', 'family_id', 'kid_name', 'note', 'items', 'status', 'parent_note', 'total_yen', 'approved_by', 'cart_url', 'created_at', 'updated_at'],
}
const RLS_COLUMN = { families: 'code', requests: 'family_id' }
const STATUSES = ['pending', 'approved', 'rejected', 'ordered']
const db = { families: [], requests: [] }
const notifyCalls = new Map()

function validate(table, row) {
  const unknown = Object.keys(row).find((k) => !COLUMNS[table].includes(k))
  if (unknown) return { status: 400, code: 'PGRST204', message: `Could not find the '${unknown}' column of '${table}'` }
  if (table === 'families' && !/^[A-Z0-9]{6}$/.test(row.code)) return { status: 400, code: '23514', message: 'families_code_check' }
  if (table === 'requests' && !STATUSES.includes(row.status)) return { status: 400, code: '23514', message: 'requests_status_check' }
  if (table === 'requests' && !db.families.some((f) => f.code === row.family_id)) return { status: 409, code: '23503', message: 'requests_family_id_fkey' }
  return null
}

function handleRest(req, res, table, url, body) {
  const fam = req.headers['x-family-code']
  const rls = RLS_COLUMN[table]
  const eq = [...url.searchParams].filter(([, v]) => v.startsWith('eq.')).map(([k, v]) => [k, v.slice(3)])
  const match = (r) => r[rls] === fam && eq.every(([k, v]) => String(r[k]) === v)

  if (req.method === 'GET') {
    const rows = db[table].filter(match)
    const order = url.searchParams.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1))
    }
    return json(res, 200, rows)
  }
  if (req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body]
    for (const row of rows) {
      if (row[rls] !== fam) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy' })
      const bad = validate(table, row)
      if (bad) return json(res, bad.status, bad)
      const key = table === 'families' ? 'code' : 'id'
      if (db[table].some((r) => r[key] === row[key])) return json(res, 409, { code: '23505', message: 'duplicate key' })
    }
    const now = new Date().toISOString()
    const defaults = { families: { monthly_budget_yen: 1000, auto_approve: true, created_at: now }, requests: { created_at: now, updated_at: now } }[table]
    db[table].push(...rows.map((r) => ({ ...defaults, ...r })))
    return json(res, 201, null)
  }
  if (req.method === 'PATCH') {
    for (const row of db[table].filter(match)) {
      const next = { ...row, ...body }
      const bad = validate(table, next)
      if (bad) return json(res, bad.status, bad)
      Object.assign(row, next)
    }
    return json(res, 204, null)
  }
  return json(res, 405, { message: `${req.method} is not used by the app` })
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(value == null ? undefined : JSON.stringify(value))
}

const server = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] ?? '*')
  if (req.method === 'OPTIONS') return json(res, 204, null)

  const url = new URL(req.url, `http://${req.headers.host}`)
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined

  if (url.pathname === '/__test/health') return json(res, 200, { ok: true })
  const inspect = /^\/__test\/family\/([A-Z0-9]{6})$/.exec(url.pathname)
  if (inspect) {
    const code = inspect[1]
    return json(res, 200, {
      family: db.families.find((f) => f.code === code) ?? null,
      requests: db.requests.filter((r) => r.family_id === code),
      notifyCalls: notifyCalls.get(code) ?? 0,
    })
  }

  const rest = /^\/rest\/v1\/(families|requests)$/.exec(url.pathname)
  if (rest) return handleRest(req, res, rest[1], url, body)

  if (req.method === 'POST' && url.pathname === '/functions/v1/notify-parent') {
    notifyCalls.set(body.family_id, (notifyCalls.get(body.family_id) ?? 0) + 1)
    return json(res, 200, { sent: 0 })
  }

  // 購読していない端末からの HTTP 経由の Broadcast。送信元の接続が無いので、購読者全員に届く
  if (req.method === 'POST' && url.pathname === '/realtime/v1/api/broadcast') {
    for (const m of body.messages ?? []) deliver(`realtime:${m.topic}`, m.event, m.payload, null)
    return json(res, 202, null)
  }

  return json(res, 404, { message: `stub-supabase: ${req.method} ${url.pathname} is not implemented` })
})

/** @type {Map<import('ws').WebSocket, Map<string, { joinRef: string, self: boolean }>>} */
const sockets = new Map()

function deliver(topic, event, payload, sender) {
  for (const [ws, joined] of sockets) {
    const membership = joined.get(topic)
    if (!membership) continue
    if (ws === sender && !membership.self) continue
    ws.send(encodeUserBroadcast(topic, event, payload))
  }
}

/** サーバー→クライアントの Broadcast（kind 4）。realtime-js の Serializer._decodeUserBroadcast と対になる */
function encodeUserBroadcast(topic, event, payload) {
  const t = Buffer.from(topic)
  const e = Buffer.from(event)
  const head = Buffer.from([4, t.length, e.length, 0, 1])
  return Buffer.concat([head, t, e, Buffer.from(JSON.stringify(payload ?? {}))])
}

/** クライアント→サーバーの Broadcast（kind 3）。realtime-js の Serializer._encodeUserBroadcastPush と対になる */
function decodeUserBroadcastPush(buf) {
  const [kind, joinRefLen, refLen, topicLen, eventLen, metaLen, encoding] = buf
  if (kind !== 3) throw new Error(`stub-supabase: unexpected binary kind ${kind}`)
  let at = 7 + joinRefLen + refLen
  const topic = buf.toString('utf8', at, (at += topicLen))
  const event = buf.toString('utf8', at, (at += eventLen))
  at += metaLen
  const payload = encoding === 1 ? JSON.parse(buf.toString('utf8', at)) : {}
  return { topic, event, payload }
}

const wss = new WebSocketServer({ server, path: '/realtime/v1/websocket' })
wss.on('connection', (ws) => {
  const joined = new Map()
  sockets.set(ws, joined)
  ws.on('close', () => sockets.delete(ws))
  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      const { topic, event, payload } = decodeUserBroadcastPush(data)
      if (joined.has(topic)) deliver(topic, event, payload, ws)
      return
    }
    const [joinRef, ref, topic, event, payload] = JSON.parse(data.toString())
    const reply = (response = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))
    if (event === 'heartbeat') return reply()
    if (event === 'phx_join') {
      joined.set(topic, { joinRef, self: payload?.config?.broadcast?.self === true })
      return reply({ postgres_changes: [] })
    }
    if (event === 'phx_leave') {
      joined.delete(topic)
      reply()
      ws.send(JSON.stringify([joinRef, joinRef, topic, 'phx_close', {}]))
      return
    }
    if (event === 'broadcast') {
      if (joined.has(topic)) deliver(topic, payload.event, payload.payload, ws)
      return
    }
    // access_token など、このアプリの E2E に関係しないイベントは受け流す
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`stub-supabase on http://127.0.0.1:${PORT}`))
