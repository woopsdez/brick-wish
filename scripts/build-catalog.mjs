#!/usr/bin/env node
/**
 * Rebrickable の公開データからカタログ (src/catalog/catalog.json) を生成する。
 *
 *   REBRICKABLE_API_KEY=xxxx node scripts/build-catalog.mjs [--popular 20] [--min-sets 30]
 *
 * 選抜方針:
 *   - 基本は scripts/curated-parts.mjs の厳選リスト（ミニメカ向け）。CSV で実在確認し、無い番号は警告して除外
 *   - --popular N を付けると、各カテゴリに「収録セット数」上位 N 件を追加で足す
 *
 * データソース:
 *   1. CSV ダウンロード（キー不要） https://rebrickable.com/downloads/
 *        colors.csv, part_categories.csv, parts.csv, elements.csv, inventory_parts.csv
 *      → パーツごとの「収録セット数」を人気スコアにし、カテゴリ別上位を選ぶ
 *   2. API v3（キー必要） https://rebrickable.com/api/v3/docs/
 *        /lego/colors/           → 色ごとの BrickLink 色 ID (external_ids.BrickLink.ext_ids)
 *        /lego/parts/?part_nums= → パーツごとの BrickLink ID (external_ids.BrickLink)
 *
 * API キーが無い場合は CSV だけで生成し、BrickLink ID は part_num をそのまま使う（多くは一致するが例外あり）。
 * BrickLink 色 ID は既存の catalog.json にある値を引き継ぐ。
 *
 * ⚠ Rebrickable の画像 CDN へのホットリンクは利用規約を未確認。公開運用前に確認すること。
 */
import { createGunzip } from 'node:zlib'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { createReadStream } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES as CURATED_CATEGORIES, COLORS as CURATED_COLORS, PARTS as CURATED_PARTS } from './curated-parts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cacheDir = resolve(here, '.cache')
const outPath = resolve(here, '../src/catalog/catalog.json')
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : [])).filter((x) => x.length),
)
const POPULAR_PER_CATEGORY = Number(args.popular ?? 0)
const MIN_SETS = Number(args['min-sets'] ?? 30)
const API_KEY = process.env.REBRICKABLE_API_KEY
const CDN = 'https://cdn.rebrickable.com/media/downloads/'

mkdirSync(cacheDir, { recursive: true })

// --- 子ども向けカテゴリ（厳選リストと共通）。--popular 用に Rebrickable の part_categories.name を割り当てる ---
const RB_CATEGORY_TO_KID = {
  'Bricks': 'basic', 'Bricks Special': 'snot', 'Bricks Round and Cones': 'round', 'Bricks Curved': 'small-tile',
  'Plates': 'small-plate', 'Plates Special': 'clip', 'Plates Round Curved and Dishes': 'round', 'Plates Angled': 'small-plate',
  'Tiles': 'small-tile', 'Tiles Special': 'small-tile', 'Tiles Round and Curved': 'round',
  'Bricks Sloped': 'small-tile', 'Bricks Wedged': 'small-tile', 'Wedges': 'small-tile',
  'Technic Bricks': 'technic', 'Technic Beams': 'technic', 'Technic Pins': 'technic', 'Technic Axles': 'technic', 'Technic Connectors': 'technic',
  'Technic Bushes': 'technic', 'Technic Beams Special': 'technic', 'Technic Special': 'joint',
  'Wheels and Tyres': 'wheel', 'Hinges, Arms and Turntables': 'hinge', 'Clips': 'clip', 'Bars, Ladders and Fences': 'clip',
  'Minifig Accessories': 'robot', 'Tools': 'robot', 'Weapons': 'robot',
}
const CATEGORY_MAP = CURATED_CATEGORIES.map(([id, name_ja, emoji, description]) => [id, name_ja, emoji, description])

// --- 色の子ども向け表示名（分からない色は英名のまま） ----------------------------------------------
const COLOR_JA = {
  Red: 'あか', Blue: 'あお', Yellow: 'きいろ', Green: 'みどり', 'Bright Green': 'あかるいみどり', Lime: 'きみどり', Orange: 'オレンジ',
  White: 'しろ', Black: 'くろ', 'Light Bluish Gray': 'うすいグレー', 'Dark Bluish Gray': 'こいグレー', Tan: 'ベージュ', 'Dark Tan': 'こいベージュ',
  'Reddish Brown': 'ちゃいろ', 'Medium Nougat': 'うすちゃいろ', 'Dark Blue': 'こいあお', 'Medium Blue': 'みずいろ', 'Dark Azure': 'アズール',
  'Medium Azure': 'うすアズール', 'Bright Light Blue': 'うすいあお', 'Dark Green': 'こいみどり', 'Dark Red': 'こいあか', 'Dark Pink': 'こいピンク',
  'Bright Pink': 'ピンク', 'Bright Light Orange': 'うすいオレンジ', 'Bright Light Yellow': 'うすいきいろ', 'Dark Purple': 'むらさき',
  'Trans-Clear': 'とうめい', 'Trans-Red': 'とうめい・あか', 'Trans-Light Blue': 'とうめい・みずいろ', 'Trans-Neon Green': 'とうめい・きみどり',
  'Trans-Yellow': 'とうめい・きいろ', 'Trans-Dark Blue': 'とうめい・あお', 'Trans-Green': 'とうめい・みどり', 'Trans-Orange': 'とうめい・オレンジ',
  'Light Nougat': 'はだいろ', Nougat: 'こいはだいろ', 'Sand Green': 'くすみみどり', 'Sand Blue': 'くすみあお', 'Dark Orange': 'こいオレンジ',
  'Dark Brown': 'こいちゃいろ', Lavender: 'ラベンダー', 'Medium Lavender': 'こいラベンダー', Coral: 'コーラル', 'Yellowish Green': 'きみどり（うすい）',
  'Olive Green': 'オリーブ', 'Dark Turquoise': 'ターコイズ', Magenta: 'マゼンタ', Pink: 'うすピンク', 'Light Aqua': 'うすいアクア', 'Pearl Gold': 'きん',
  'Flat Silver': 'ぎん', 'Pearl Dark Gray': 'くろがね', 'Chrome Silver': 'クロームぎん', 'Metallic Silver': 'メタリックぎん', 'Metallic Gold': 'メタリックきん',
}

// 子ども向けカタログに入れる色（Rebrickable 名）。無指定なら elements にある色をすべて採用
const COLOR_ALLOW = new Set([...Object.keys(COLOR_JA), ...CURATED_COLORS.map((c) => c[1])])
for (const [, name, name_ja] of CURATED_COLORS) COLOR_JA[name] ??= name_ja

async function download(name) {
  const gz = resolve(cacheDir, `${name}.csv.gz`)
  const csv = resolve(cacheDir, `${name}.csv`)
  if (!existsSync(csv)) {
    console.log(`downloading ${name}.csv.gz`)
    const res = await fetch(CDN + `${name}.csv.gz`)
    if (!res.ok) throw new Error(`download failed: ${name} ${res.status}`)
    await pipeline(res.body, createWriteStream(gz))
    await pipeline(createReadStream(gz), createGunzip(), createWriteStream(csv))
  }
  return csv
}

async function* rows(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const cols = parseCsvLine(line)
    if (!header) {
      header = cols
      continue
    }
    yield Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']))
  }
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

async function api(path) {
  const url = `https://rebrickable.com/api/v3${path}${path.includes('?') ? '&' : '?'}key=${API_KEY}`
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      const wait = 1500 * (attempt + 1)
      console.log(`throttled, waiting ${wait}ms`)
      await new Promise((r) => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
    return res.json()
  }
  throw new Error(`API gave up: ${path}`)
}

async function main() {
  const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : null
  const prevBlColor = new Map((prev?.colors ?? []).map((c) => [c.id, c.bl_id]))
  const prevLegoColor = new Map((prev?.colors ?? []).map((c) => [c.id, c.lego_id ?? null]))
  const curatedLego = new Map(CURATED_COLORS.map((c) => [c[0], c[6] ?? null]))

  // 1. カテゴリ
  const catNameById = new Map()
  for await (const r of rows(await download('part_categories'))) catNameById.set(r.id, r.name)

  // 2. 色
  const colors = new Map()
  for await (const r of rows(await download('colors'))) {
    if (r.id === '-1' || r.id === '9999') continue
    if (!COLOR_ALLOW.has(r.name)) continue
    colors.set(Number(r.id), { id: Number(r.id), name: r.name, name_ja: COLOR_JA[r.name] ?? r.name, rgb: r.rgb, is_trans: r.is_trans === 'True' || r.is_trans === 't', bl_id: prevBlColor.get(Number(r.id)) ?? null, lego_id: prevLegoColor.get(Number(r.id)) ?? curatedLego.get(Number(r.id)) ?? null })
  }
  const curatedColorBl = new Map(CURATED_COLORS.map((c) => [c[0], c[5]]))
  for (const c of colors.values()) if (c.bl_id == null && curatedColorBl.has(c.id)) c.bl_id = curatedColorBl.get(c.id)

  // 3. 厳選リストを parts.csv で実在確認
  const curated = new Map(CURATED_PARTS.map(([num, name, name_ja, category, colorPref, score]) => [num, { num, name, name_ja, category, colorPref: new Set(colorPref), score }]))
  const parts = new Map()
  const allParts = new Map()
  for await (const r of rows(await download('parts'))) {
    const catName = catNameById.get(r.part_cat_id)
    allParts.set(r.part_num, { num: r.part_num, name: r.name, catName })
    const cur = curated.get(r.part_num)
    if (cur) {
      parts.set(r.part_num, { num: r.part_num, name: r.name, name_ja: cur.name_ja, category: cur.category, rb_category: catName, bl_id: null, colors: new Map(), score: cur.score, curated: true, colorPref: cur.colorPref, _invs: new Set() })
    } else if (POPULAR_PER_CATEGORY > 0 && catName && RB_CATEGORY_TO_KID[catName] && !EXCLUDE_CATEGORY.has(catName)) {
      parts.set(r.part_num, { num: r.part_num, name: r.name, name_ja: r.name, category: RB_CATEGORY_TO_KID[catName], rb_category: catName, bl_id: null, colors: new Map(), score: 0, curated: false, colorPref: null, _invs: new Set() })
    }
  }
  const missing = [...curated.keys()].filter((n) => !parts.has(n))
  if (missing.length) {
    console.warn(`⚠ 厳選リストのうち parts.csv に無い番号 (${missing.length}): ${missing.join(', ')}`)
    console.warn('   Rebrickable で正しい part_num を調べて scripts/curated-parts.mjs を直してください（例: 4085 → 4085c など）')
  }

  // 4. 色の実在と人気度（収録セット数 = inventory_parts の distinct inventory_id 数）
  console.log(`${parts.size} candidate parts; scanning inventory_parts (large file)...`)
  for await (const r of rows(await download('inventory_parts'))) {
    if (r.is_spare === 'True' || r.is_spare === 't') continue
    const p = parts.get(r.part_num)
    if (!p) continue
    p._invs.add(r.inventory_id)
    const cid = Number(r.color_id)
    if (colors.has(cid)) p.colors.set(cid, p.colors.get(cid) ?? null)
  }
  for (const p of parts.values()) {
    p.popularity = p._invs.size
    if (!p.curated) p.score = p.popularity
    delete p._invs
    // 厳選パーツは「希望色 ∩ 実在色」。実在色が 1 つも無ければ実在色すべて
    if (p.curated && p.colorPref?.size) {
      const inter = [...p.colors.keys()].filter((c) => p.colorPref.has(c))
      if (inter.length) for (const c of [...p.colors.keys()]) if (!p.colorPref.has(c)) p.colors.delete(c)
    }
  }

  // 5. element_id（画像・Pick a Brick 用）
  for await (const r of rows(await download('elements'))) {
    const p = parts.get(r.part_num)
    const cid = Number(r.color_id)
    if (p && p.colors.has(cid) && !p.colors.get(cid)) p.colors.set(cid, r.element_id)
  }

  // 6. 選抜: 厳選リスト全部 + （--popular 指定時）カテゴリごとの人気上位
  const selected = [...parts.values()].filter((p) => p.curated && p.colors.size > 0)
  const noColor = [...parts.values()].filter((p) => p.curated && p.colors.size === 0).map((p) => p.num)
  if (noColor.length) console.warn(`⚠ 色データが見つからず除外 (${noColor.length}): ${noColor.join(', ')}`)
  if (POPULAR_PER_CATEGORY > 0) {
    for (const [kidCat] of CATEGORY_MAP) {
      const list = [...parts.values()]
        .filter((p) => !p.curated && p.category === kidCat && p.popularity >= MIN_SETS && p.colors.size > 0)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, POPULAR_PER_CATEGORY)
      selected.push(...list)
    }
  }
  console.log(`selected ${selected.length} parts`)

  // 7. API で BrickLink ID を補完
  if (API_KEY) {
    console.log('fetching BrickLink ids from Rebrickable API...')
    let page = 1
    for (;;) {
      const data = await api(`/lego/colors/?page_size=200&page=${page}`)
      for (const c of data.results) {
        const col = colors.get(c.id)
        const bl = c.external_ids?.BrickLink?.ext_ids?.[0]
        if (col && bl != null) col.bl_id = Number(bl)
        // LEGO 社の色 ID（国内ショップの商品キー「品番-色ID」に使う）。複数あれば先頭
        const lego = c.external_ids?.LEGO?.ext_ids?.[0]
        if (col && lego != null) col.lego_id = Number(lego)
      }
      if (!data.next) break
      page++
    }
    for (let i = 0; i < selected.length; i += 100) {
      const chunk = selected.slice(i, i + 100)
      const data = await api(`/lego/parts/?inc_part_details=1&page_size=100&part_nums=${chunk.map((p) => encodeURIComponent(p.num)).join(',')}`)
      for (const r of data.results) {
        const p = parts.get(r.part_num)
        const bl = r.external_ids?.BrickLink?.[0]
        if (p && bl) p.bl_id = String(bl)
      }
      await new Promise((r) => setTimeout(r, 1100)) // レート制限対策
    }
  } else {
    console.warn('REBRICKABLE_API_KEY が無いため BrickLink ID は part_num を流用します（色 ID は既存値を引き継ぎ）')
  }

  // 8. 出力
  const prevJa = new Map((prev?.parts ?? []).map((p) => [p.num, p.name_ja]))
  const usedColorIds = new Set()
  const outParts = selected.map((p) => {
    const cols = [...p.colors.entries()].map(([color_id, element_id]) => ({ color_id, element_id }))
    cols.forEach((c) => usedColorIds.add(c.color_id))
    const ja = p.curated ? p.name_ja : prevJa.get(p.num) && prevJa.get(p.num) !== p.name ? prevJa.get(p.num) : p.name
    return { num: p.num, name: p.name, name_ja: ja, category: p.category, bl_id: p.bl_id, colors: cols, score: p.score }
  })

  const catalog = {
    generated_at: new Date().toISOString(),
    source: `Rebrickable CSV downloads${API_KEY ? ' + API v3 external_ids' : ' (no API key: BrickLink ids unverified)'}`,
    colors: [...colors.values()].filter((c) => usedColorIds.has(c.id)).sort((a, b) => a.id - b.id),
    categories: CATEGORY_MAP.map(([id, name_ja, emoji, description]) => ({ id, name_ja, emoji, description })),
    parts: outParts,
  }
  writeFileSync(outPath, JSON.stringify(catalog, null, 1))
  console.log(`wrote ${outPath}: ${outParts.length} parts, ${catalog.colors.length} colors`)
  const noBl = catalog.colors.filter((c) => c.bl_id == null).length
  if (noBl) console.warn(`${noBl} colors have no BrickLink id`)
  const noLego = catalog.colors.filter((c) => c.lego_id == null).length
  if (noLego) console.warn(`${noLego} colors have no LEGO color id (shop-map will skip them)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
