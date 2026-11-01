#!/usr/bin/env node
/**
 * Rebrickable の公開データからカタログ (src/catalog/catalog.json) を生成する。
 *
 *   REBRICKABLE_API_KEY=xxxx node scripts/build-catalog.mjs [--top 40] [--min-sets 30]
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

const here = dirname(fileURLToPath(import.meta.url))
const cacheDir = resolve(here, '.cache')
const outPath = resolve(here, '../src/catalog/catalog.json')
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : [])).filter((x) => x.length),
)
const TOP_PER_CATEGORY = Number(args.top ?? 40)
const MIN_SETS = Number(args['min-sets'] ?? 30)
const API_KEY = process.env.REBRICKABLE_API_KEY
const CDN = 'https://cdn.rebrickable.com/media/downloads/'

mkdirSync(cacheDir, { recursive: true })

// --- 子ども向けカテゴリ: Rebrickable の part_categories.name を割り当てる -------------------------
const CATEGORY_MAP = [
  ['brick', 'ブロック', '🧱', ['Bricks', 'Bricks Special', 'Bricks Round and Cones', 'Bricks Curved']],
  ['plate', 'プレート', '▬', ['Plates', 'Plates Special', 'Plates Round Curved and Dishes', 'Plates Angled']],
  ['tile', 'タイル', '◻️', ['Tiles', 'Tiles Special', 'Tiles Round and Curved']],
  ['slope', 'スロープ', '📐', ['Bricks Sloped', 'Bricks Wedged', 'Wedges']],
  ['technic', 'テクニック', '⚙️', ['Technic Bricks', 'Technic Beams', 'Technic Pins', 'Technic Axles', 'Technic Gears', 'Technic Connectors', 'Technic Bushes', 'Technic Beams Special', 'Technic Panels', 'Technic Steering, Suspension and Engine', 'Technic Special']],
  ['wheel', 'タイヤ・くるま', '🚗', ['Wheels and Tyres', 'Vehicle', 'Transportation - Land', 'Windscreens and Fuselage']],
  ['window', 'まど・ドア', '🚪', ['Windows and Doors', 'Baseplates', 'Panels', 'Supports, Girders and Cranes', 'Fences, Ladders and Trellises', 'Stairs']],
  ['nature', 'はな・き', '🌳', ['Plants and Animals', 'Rock']],
  ['minifig', 'ミニフィグ', '🧑', ['Minifig Accessories', 'Minifig Heads', 'Minifig Headwear', 'Minifig Upper Body', 'Minifig Lower Body', 'Minifigs', 'Tools', 'Weapons', 'Flags, Signs, Plastics and Cloth', 'Containers', 'Food']],
  ['special', 'とくべつ', '✨', ['Hinges, Arms and Turntables', 'Clips', 'Bars, Ladders and Fences', 'Magnets and Holders', 'Other', 'Non-LEGO']],
]
const EXCLUDE_CATEGORY = new Set(['Stickers', 'Duplo, Quatro and Primo', 'Non-Buildable Figures (Duplo, Fabuland, etc)', 'Large Buildable Figures', 'Electronics', 'Mindstorms', 'Power Functions', 'Pneumatics', 'Modulex', 'Znap', 'HO Scale', 'Belville, Scala and Fabuland', 'Clikits', 'String, Bands and Reels', 'Hinges, Arms and Turntables'])

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
const COLOR_ALLOW = new Set(Object.keys(COLOR_JA))

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

  // 1. カテゴリ
  const catNameById = new Map()
  for await (const r of rows(await download('part_categories'))) catNameById.set(r.id, r.name)
  const kidCatOf = (rbCatName) => CATEGORY_MAP.find(([, , , names]) => names.includes(rbCatName))?.[0] ?? null

  // 2. 色
  const colors = new Map()
  for await (const r of rows(await download('colors'))) {
    if (r.id === '-1' || r.id === '9999') continue
    if (!COLOR_ALLOW.has(r.name)) continue
    colors.set(Number(r.id), { id: Number(r.id), name: r.name, name_ja: COLOR_JA[r.name] ?? r.name, rgb: r.rgb, is_trans: r.is_trans === 'True' || r.is_trans === 't', bl_id: prevBlColor.get(Number(r.id)) ?? null })
  }

  // 3. パーツと人気度（収録セット数 = inventory_parts の distinct inventory_id 数）
  const parts = new Map()
  for await (const r of rows(await download('parts'))) {
    const catName = catNameById.get(r.part_cat_id)
    if (!catName || EXCLUDE_CATEGORY.has(catName)) continue
    const kidCat = kidCatOf(catName)
    if (!kidCat) continue
    parts.set(r.part_num, { num: r.part_num, name: r.name, name_ja: r.name, category: kidCat, rb_category: catName, bl_id: null, colors: new Map(), score: 0, _invs: new Set() })
  }
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
    p.score = p._invs.size
    delete p._invs
  }

  // 4. element_id（画像・Pick a Brick 用）
  for await (const r of rows(await download('elements'))) {
    const p = parts.get(r.part_num)
    const cid = Number(r.color_id)
    if (p && p.colors.has(cid) && !p.colors.get(cid)) p.colors.set(cid, r.element_id)
  }

  // 5. カテゴリごとに上位を選抜
  const selected = []
  for (const [kidCat] of CATEGORY_MAP) {
    const list = [...parts.values()]
      .filter((p) => p.category === kidCat && p.score >= MIN_SETS && p.colors.size > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_PER_CATEGORY)
    selected.push(...list)
  }
  console.log(`selected ${selected.length} parts`)

  // 6. API で BrickLink ID を補完
  if (API_KEY) {
    console.log('fetching BrickLink ids from Rebrickable API...')
    let page = 1
    for (;;) {
      const data = await api(`/lego/colors/?page_size=200&page=${page}`)
      for (const c of data.results) {
        const col = colors.get(c.id)
        const bl = c.external_ids?.BrickLink?.ext_ids?.[0]
        if (col && bl != null) col.bl_id = Number(bl)
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

  // 7. 以前の手書き日本語名があれば引き継ぐ
  const prevJa = new Map((prev?.parts ?? []).map((p) => [p.num, p.name_ja]))
  const usedColorIds = new Set()
  const outParts = selected.map((p) => {
    const cols = [...p.colors.entries()].map(([color_id, element_id]) => ({ color_id, element_id }))
    cols.forEach((c) => usedColorIds.add(c.color_id))
    return { num: p.num, name: p.name, name_ja: prevJa.get(p.num) && prevJa.get(p.num) !== p.name ? prevJa.get(p.num) : p.name, category: p.category, bl_id: p.bl_id, colors: cols, score: p.score }
  })

  const catalog = {
    generated_at: new Date().toISOString(),
    source: `Rebrickable CSV downloads${API_KEY ? ' + API v3 external_ids' : ' (no API key: BrickLink ids unverified)'}`,
    colors: [...colors.values()].filter((c) => usedColorIds.has(c.id)).sort((a, b) => a.id - b.id),
    categories: CATEGORY_MAP.map(([id, name_ja, emoji]) => ({ id, name_ja, emoji })),
    parts: outParts,
  }
  writeFileSync(outPath, JSON.stringify(catalog, null, 1))
  console.log(`wrote ${outPath}: ${outParts.length} parts, ${catalog.colors.length} colors`)
  const noBl = catalog.colors.filter((c) => c.bl_id == null).length
  if (noBl) console.warn(`${noBl} colors have no BrickLink id`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
