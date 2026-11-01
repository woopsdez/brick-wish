#!/usr/bin/env node
/**
 * 「ぜんぶ」タブ用の全パーツ索引を Rebrickable の CSV から作る → public/all-parts.json
 *
 *   node scripts/build-all-parts.mjs                   # 既定: 2015 年以降のセットに 2 回以上入ったパーツ
 *   node scripts/build-all-parts.mjs --min-year 2018 --min-sets 3
 *
 * データ源（キー不要、scripts/.cache にキャッシュ）: https://rebrickable.com/downloads/
 *   parts, part_categories, elements, inventories, inventory_parts, sets
 * 除外: ミニフィグ・ステッカー・デュプロなどのカテゴリ、印刷パーツ（品番に pr/pb/pat）
 * 色: catalog.json にある 32 色だけ（LEGO 色 ID が分かる色＝ブリッカーズの商品 URL が組める色）
 * 価格は持たない。保護者が商品ページで確認する前提。
 *
 * ⚠ Rebrickable のデータを同梱して配布してよいかは利用条件を確認すること（公開前）。
 */
import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cacheDir = resolve(here, '.cache')
const outPath = resolve(here, '../public/all-parts.json')
const catalog = JSON.parse(readFileSync(resolve(here, '../src/catalog/catalog.json'), 'utf8'))
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : [])).filter((x) => x.length),
)
const MIN_YEAR = Number(args['min-year'] ?? 2015)
const MIN_SETS = Number(args['min-sets'] ?? 2)
const CDN = 'https://cdn.rebrickable.com/media/downloads/'

mkdirSync(cacheDir, { recursive: true })

/** Rebrickable のカテゴリ名 → 日本語名と、画像が無いときのイラスト種別（PartGlyph の category） */
const CATEGORY_JA = {
  Bricks: ['ブロック', 'basic'],
  'Bricks Curved': ['カーブブロック', 'basic'],
  'Bricks Round and Cones': ['丸ブロック・コーン', 'round'],
  'Bricks Sloped': ['スロープ', 'small-tile'],
  'Bricks Special': ['特殊ブロック', 'snot'],
  'Bricks Wedged': ['ウェッジブロック', 'basic'],
  Plates: ['プレート', 'small-plate'],
  'Plates Round Curved and Dishes': ['丸プレート・ディッシュ', 'round'],
  'Plates Special': ['特殊プレート', 'small-plate'],
  'Plates Angled': ['角度付きプレート', 'small-plate'],
  Wedges: ['ウェッジ', 'small-plate'],
  Tiles: ['タイル', 'small-tile'],
  'Tiles Round and Curved': ['丸タイル', 'round'],
  'Tiles Special': ['特殊タイル', 'small-tile'],
  Panels: ['パネル', 'snot'],
  Baseplates: ['基礎板', 'small-plate'],
  'Hinges, Arms and Turntables': ['ヒンジ・アーム・ターンテーブル', 'hinge'],
  'Bars, Ladders and Fences': ['バー・はしご・フェンス', 'clip'],
  Clips: ['クリップ', 'clip'],
  'Technic Bricks': ['テクニックブロック', 'technic'],
  'Technic Beams': ['テクニックビーム', 'technic'],
  'Technic Beams Special': ['テクニックビーム（特殊）', 'technic'],
  'Technic Pins': ['テクニックピン', 'technic'],
  'Technic Axles': ['テクニックアクスル', 'technic'],
  'Technic Bushes': ['テクニックブッシュ', 'technic'],
  'Technic Connectors': ['テクニックコネクタ', 'technic'],
  'Technic Gears': ['テクニックギア', 'technic'],
  'Technic Panels': ['テクニックパネル', 'technic'],
  'Technic Special': ['テクニック（その他）', 'technic'],
  'Technic Steering, Suspension and Engine': ['テクニック（足回り・エンジン）', 'technic'],
  'Wheels and Tyres': ['タイヤ・ホイール', 'wheel'],
  'Transportation - Land': ['乗り物（陸）', 'basic'],
  'Transportation - Sea and Air': ['乗り物（海・空）', 'basic'],
  'Windows and Doors': ['窓・ドア', 'basic'],
  Containers: ['入れ物', 'basic'],
  'Supports, Girders and Cranes': ['支柱・クレーン', 'technic'],
  'Flags, Signs, Plastics and Cloth': ['旗・看板・布', 'basic'],
  'Plants and Animals': ['植物・動物', 'basic'],
  Rock: ['岩', 'basic'],
  'Tubes and Hoses': ['チューブ・ホース', 'technic'],
  'String, Bands and Reels': ['ひも・バンド', 'basic'],
  'Magnets and Holders': ['磁石', 'basic'],
  'Projectiles / Launchers': ['発射装置', 'basic'],
  Tools: ['道具', 'robot'],
  'Bionicle, Hero Factory and Constraction': ['バイオニクル・ヒーローファクトリー', 'joint'],
  'Large Buildable Figures': ['大型フィギュア', 'joint'],
  Mechanical: ['メカニカル', 'technic'],
  Electronics: ['電装', 'technic'],
  Pneumatics: ['ニューマチック', 'technic'],
  Trains: ['トレイン', 'basic'],
  Other: ['その他', 'basic'],
  'Gear Parts': ['ギア', 'technic'],
  Animals: ['動物', 'basic'],
  'Animals / Creatures': ['動物・生き物', 'basic'],
  'Animal / Creature Body Parts': ['動物のパーツ', 'basic'],
  'Animal / Creature Accessories': ['動物の小物', 'basic'],
  Creatures: ['生き物', 'basic'],
  'Flags, Banners and Signs': ['旗・看板', 'basic'],
  'Windscreens and Fuselage': ['風防・機体', 'basic'],
  'Plates Wedged': ['ウェッジプレート', 'small-plate'],
  'Energy Effects': ['エフェクト', 'basic'],
  'Plants & Trees': ['植物', 'basic'],
}
const EXCLUDE_CATEGORY = /minifig|minidoll|sticker|duplo|non-lego|non-system|scala|belville|clikits|znap|modulex|primo|quatro|fabuland|homemaker|ho scale|pen & watch/i
const PRINTED = /(pr|pb|pat)\d/i

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

async function main() {
  const knownColors = new Set(catalog.colors.map((c) => c.id))

  // 1. カテゴリ
  const cats = new Map() // id -> { id, name, name_ja, glyph }
  const unmapped = []
  for await (const r of rows(await download('part_categories'))) {
    if (EXCLUDE_CATEGORY.test(r.name)) continue
    const ja = CATEGORY_JA[r.name]
    if (!ja) unmapped.push(r.name)
    cats.set(Number(r.id), { id: Number(r.id), name: r.name, name_ja: ja?.[0] ?? r.name, glyph: ja?.[1] ?? 'basic' })
  }

  // 2. セットの年 → インベントリの年
  const setYear = new Map()
  for await (const r of rows(await download('sets'))) setYear.set(r.set_num, Number(r.year))
  const invYear = new Map()
  for await (const r of rows(await download('inventories'))) {
    const y = setYear.get(r.set_num)
    if (y != null) invYear.set(r.id, y)
  }

  // 3. インベントリの部品 → パーツごとの「何セットに入ったか」「最新年」「出た色」
  const stats = new Map() // part_num -> { sets: Set<inventory_id>, year, colors: Set<color_id> }
  for await (const r of rows(await download('inventory_parts'))) {
    const y = invYear.get(r.inventory_id)
    if (y == null || y < MIN_YEAR) continue
    const color = Number(r.color_id)
    if (!knownColors.has(color)) continue
    let s = stats.get(r.part_num)
    if (!s) stats.set(r.part_num, (s = { sets: new Set(), year: 0, colors: new Set() }))
    s.sets.add(r.inventory_id)
    if (y > s.year) s.year = y
    s.colors.add(color)
  }

  // 4. 画像用の element id（部品×色 → 1 つ）
  const elements = new Map() // `${part}|${color}` -> element_id
  for await (const r of rows(await download('elements'))) {
    if (!stats.has(r.part_num)) continue
    const k = `${r.part_num}|${r.color_id}`
    if (!elements.has(k)) elements.set(k, r.element_id)
  }

  // 5. parts.csv で名前とカテゴリを付け、絞り込む
  const parts = []
  let seen = 0
  for await (const r of rows(await download('parts'))) {
    seen++
    const s = stats.get(r.part_num)
    if (!s || s.sets.size < MIN_SETS) continue
    if (PRINTED.test(r.part_num) || /sticker/i.test(r.name)) continue
    const cat = cats.get(Number(r.part_cat_id))
    if (!cat) continue
    const colors = [...s.colors].sort((a, b) => a - b).map((c) => [c, elements.get(`${r.part_num}|${c}`) ?? null])
    parts.push([r.part_num, r.name, cat.id, s.sets.size, colors])
  }
  parts.sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0]))
  const usedCats = new Set(parts.map((p) => p[2]))
  const catCount = new Map()
  for (const p of parts) catCount.set(p[2], (catCount.get(p[2]) ?? 0) + 1)

  const out = {
    generated_at: new Date().toISOString(),
    source: `Rebrickable CSV (${new Date().toISOString().slice(0, 10)}); sets since ${MIN_YEAR}, ≥${MIN_SETS} sets; printed parts, minifigs, stickers excluded`,
    min_year: MIN_YEAR,
    fields: ['num', 'name', 'cat', 'sets', 'colors[color_id, element_id]'],
    // パーツ数の多いカテゴリから並べる（ブロック・プレートが先に来る）
    categories: [...cats.values()].filter((c) => usedCats.has(c.id)).sort((a, b) => catCount.get(b.id) - catCount.get(a.id) || a.name.localeCompare(b.name)),
    parts,
  }
  writeFileSync(outPath, JSON.stringify(out))
  const bytes = Buffer.byteLength(JSON.stringify(out))
  console.log(`wrote ${outPath}: ${parts.length} parts (of ${seen} in parts.csv), ${out.categories.length} categories, ${(bytes / 1024).toFixed(0)} KB`)
  if (unmapped.length) console.log(`categories without Japanese name (shown in English): ${unmapped.join(' / ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
