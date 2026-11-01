#!/usr/bin/env node
/** catalog.json / shop-map.json の整合チェック（npm test）。外部アクセスなし */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(readFileSync(resolve(here, '../src/catalog/catalog.json'), 'utf8'))
const shop = JSON.parse(readFileSync(resolve(here, '../src/catalog/shop-map.json'), 'utf8'))

const errors = []
const colorIds = new Set(catalog.colors.map((c) => c.id))
const seen = new Set()
for (const p of catalog.parts) {
  if (seen.has(p.num)) errors.push(`duplicate part ${p.num}`)
  seen.add(p.num)
  if (!p.colors.length) errors.push(`${p.num} has no colors`)
  for (const c of p.colors) if (!colorIds.has(c.color_id)) errors.push(`${p.num} refers to unknown color ${c.color_id}`)
  if (!catalog.categories.some((c) => c.id === p.category)) errors.push(`${p.num} has unknown category ${p.category}`)
  if (!p.name_ja) errors.push(`${p.num} has no name_ja`)
}
const noLego = catalog.colors.filter((c) => c.lego_id == null).map((c) => c.name)
if (noLego.length) console.warn(`colors without LEGO id (shop lookup skipped): ${noLego.join(', ')}`)

let mapped = 0
for (const p of catalog.parts) {
  for (const c of p.colors) {
    const col = catalog.colors.find((x) => x.id === c.color_id)
    if (col?.lego_id == null) continue
    const key = `${p.num}-${String(col.lego_id).padStart(3, '0')}`
    if (shop.items[key]) mapped++
  }
}
for (const [key, it] of Object.entries(shop.items)) {
  if (!/^[0-9a-z]+-\d{3}$/i.test(key)) errors.push(`shop key ${key} is not 品番-色ID`)
  if (it.available && (it.price_yen == null || it.price_yen <= 0)) errors.push(`shop item ${key} available but no price`)
}

console.log(`catalog: ${catalog.parts.length} parts, ${catalog.colors.length} colors; shop-map: ${Object.keys(shop.items).length} items (${mapped} matched)${shop.sample ? ' [SAMPLE]' : ''}`)
if (errors.length) {
  for (const e of errors) console.error('ERR', e)
  process.exit(1)
}
console.log('ok')
