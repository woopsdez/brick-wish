#!/usr/bin/env node
/**
 * 国内ショップ（ブリッカーズ、Shopify）の在庫・価格を catalog.json の 品番×色 ごとに引いて shop-map を作る。
 *
 *   node scripts/build-shop-map.mjs                 # 本物を取得して src/catalog/shop-map.json に書く（1 秒 1 件、scripts/.cache/shop にキャッシュ。コミットする）
 *   node scripts/build-shop-map.mjs --sample        # ダミー価格で生成（開発用）
 *   node scripts/build-shop-map.mjs --local         # 本物を src/catalog/shop-map.local.json に書く（gitignore。試しに取るとき）
 *   node scripts/build-shop-map.mjs --shop https://starbrick37.com --id starbrick37 --name StarBrick37
 *
 * ブリッカーズの利用規約（第4条）は自動取得と価格データの保存・自他サービスでの利用を禁じているが、
 * このアプリ（価格・在庫を表示して同店のカートへ誘導する家庭用）については 2026-11-01 に先方の許可を得た。
 * 取得は 1 秒 1 件・キャッシュ前提で、更新は月 1 回程度にとどめる。
 *
 * 商品キーは「品番-LEGO色ID3桁」（例 3024-026 = プレート1×1 黒）。ブリッカーズと StarBrick37 が同じ形式。
 * Shopify の公開 JSON `/products/<handle>.js` を読む。404 なら取り扱いなし。
 *
 * 確認済み（2026-11-01、14417-199 の商品ページと突き合わせ）: `.js` の price は円×100（¥18 → 1800）。違う店なら --price-scale 1
 * 未検証: LEGO 色 ID（catalog.json の lego_id）は build-catalog.mjs が Rebrickable から埋める。starter カタログの値は記憶ベース
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const catalogPath = resolve(here, '../src/catalog/catalog.json')
const cacheDir = resolve(here, '.cache/shop')
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? 'true' : arr[i + 1]] : [])).filter((x) => x.length),
)
const SAMPLE = args.sample === 'true'
const LOCAL = args.local === 'true'
const outPath = resolve(here, LOCAL ? '../src/catalog/shop-map.local.json' : '../src/catalog/shop-map.json')
const SHOP_URL = (args.shop ?? 'https://brickers.jp').replace(/\/$/, '')
const SHOP_ID = args.id ?? 'brickers'
const SHOP_NAME = args.name ?? 'ブリッカーズ'
const DELAY_MS = Number(args.delay ?? 1000)
const PRICE_SCALE = Number(args['price-scale'] ?? 100)
const UA = 'brick-wish-shop-map/0.1 (family wish-cart; https://github.com/woopsdez/brick-wish)'

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const colorById = new Map(catalog.colors.map((c) => [c.id, c]))

function key(num, legoId) {
  return `${num}-${String(legoId).padStart(3, '0')}`
}

// ---------------------------------------------------------------- サンプル
// カテゴリごとの相場感（ブリッカーズ・StarBrick37 の公開価格から 2026/11 に目視した水準。あくまでダミー）
const SAMPLE_BASE = { 'small-plate': 15, 'small-tile': 18, round: 15, clip: 25, joint: 35, hinge: 40, snot: 30, technic: 22, robot: 45, wheel: 40, basic: 20 }
function hash(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}
function sampleItem(part, color) {
  const k = key(part.num, color.lego_id)
  const h = hash(k)
  const base = SAMPLE_BASE[part.category] ?? 20
  const mult = color.is_trans || color.id === 179 || color.id === 297 ? 2 : [71, 72, 0, 15, 4, 1, 14].includes(color.id) ? 1 : 1.4
  const available = h % 10 !== 0 // 1 割は売り切れにしておく
  return { variant_id: 40000000000000 + (h % 1000000000), price_yen: Math.round(base * mult + (h % 7)), available, url: `${SHOP_URL}/products/${k}` }
}

// ---------------------------------------------------------------- 本物
async function fetchItem(k) {
  mkdirSync(cacheDir, { recursive: true })
  const cache = resolve(cacheDir, `${k}.json`)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  const url = `${SHOP_URL}/products/${k}.js`
  let result
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (res.status === 404) {
      result = null
      break
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const p = await res.json()
    const v = p.variants?.[0]
    result = {
      variant_id: v?.id ?? null,
      price_yen: v?.price != null ? Math.round(v.price / PRICE_SCALE) : null,
      available: Boolean(v?.available ?? p.available),
      url: `${SHOP_URL}/products/${p.handle ?? k}`,
      title: p.title,
    }
    break
  }
  if (result === undefined) throw new Error(`gave up: ${url}`)
  writeFileSync(cache, JSON.stringify(result))
  await sleep(DELAY_MS)
  return result
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const items = {}
  let total = 0
  let found = 0
  let noLego = 0
  for (const part of catalog.parts) {
    for (const pc of part.colors) {
      const color = colorById.get(pc.color_id)
      if (!color || color.lego_id == null) {
        noLego++
        continue
      }
      const k = key(part.num, color.lego_id)
      total++
      const it = SAMPLE ? sampleItem(part, color) : await fetchItem(k)
      if (!SAMPLE) process.stdout.write(`${k}: ${it ? `${it.available ? 'ok' : 'soldout'} ¥${it.price_yen}` : '-'}\n`)
      if (it) {
        items[k] = { variant_id: it.variant_id, price_yen: it.price_yen, available: it.available, url: it.url }
        found++
      }
    }
  }
  const out = {
    shop_id: SHOP_ID,
    shop_name: SHOP_NAME,
    base_url: SHOP_URL,
    list_order_url: null,
    fetched_at: new Date().toISOString(),
    sample: SAMPLE,
    items,
  }
  writeFileSync(outPath, JSON.stringify(out, null, 1))
  console.log(`wrote ${outPath}: ${found}/${total} part×color found${SAMPLE ? ' (SAMPLE DATA)' : ''}${noLego ? `, ${noLego} skipped (no LEGO color id)` : ''}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
