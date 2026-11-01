#!/usr/bin/env node
/**
 * 厳選リスト (curated-parts.mjs) から暫定カタログ src/catalog/catalog.json を生成する。
 * Rebrickable API キーを用意したら scripts/build-catalog.mjs で実在確認・BrickLink ID 補完を行うこと。
 *
 * ⚠ ここで出力される BrickLink 色ID (bl_id) と「このパーツがこの色で存在するか」は未検証。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, COLORS, PARTS } from './curated-parts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../src/catalog/catalog.json')

const seen = new Set()
const parts = []
for (const [num, name, name_ja, category, colors, score] of PARTS) {
  if (seen.has(num)) {
    console.warn(`duplicate part in curated list: ${num}`)
    continue
  }
  seen.add(num)
  parts.push({
    num,
    name,
    name_ja,
    category,
    bl_id: null, // 未検証。null の場合アプリは part_num を BrickLink ID として使う
    colors: [...new Set(colors)].map((color_id) => ({ color_id, element_id: null })),
    score,
  })
}

const catalog = {
  generated_at: new Date().toISOString(),
  source: 'starter (curated list, unverified). Run scripts/build-catalog.mjs to verify against Rebrickable.',
  colors: COLORS.map(([id, name, name_ja, rgb, is_trans, bl_id, lego_id]) => ({ id, name, name_ja, rgb, is_trans, bl_id, lego_id: lego_id ?? null })),
  categories: CATEGORIES.map(([id, name_ja, emoji, description]) => ({ id, name_ja, emoji, description })),
  parts,
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(catalog, null, 1))
console.log(`wrote ${out}: ${parts.length} parts, ${COLORS.length} colors, ${CATEGORIES.length} categories`)
