#!/usr/bin/env node
/**
 * src/lib/partsImport.ts の単体テスト。`npm test` で実行（Node 22.18+ の型ストリップで .ts を直接実行）。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANY_COLOR_ID, detectFormat, findColorByName, parsePartsList, rowToCartItem } from '../src/lib/partsImport.ts'
import type { Catalog } from '../src/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(readFileSync(resolve(here, '../src/catalog/catalog.json'), 'utf8')) as Catalog
const ctx = { colors: catalog.colors, parts: catalog.parts }

let n = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    n++
    console.log(`ok   ${name}`)
  } catch (e) {
    console.error(`FAIL ${name}`)
    throw e
  }
}

test('色名: 英語・略称・日本語・通称', () => {
  assert.equal(findColorByName(ctx, 'Black')?.id, 0)
  assert.equal(findColorByName(ctx, 'dark bluish grey')?.id, 72)
  assert.equal(findColorByName(ctx, 'Dk. Bluish Gray')?.id, 72)
  assert.equal(findColorByName(ctx, 'DBG')?.id, 72)
  assert.equal(findColorByName(ctx, 'LBG')?.id, 71)
  assert.equal(findColorByName(ctx, '黒')?.id, 0)
  assert.equal(findColorByName(ctx, '濃いグレー')?.id, 72)
  assert.equal(findColorByName(ctx, 'ダークグレー')?.id, 72)
  assert.equal(findColorByName(ctx, 'Trans-Clear')?.id, 47)
  assert.equal(findColorByName(ctx, 'Trans Clear')?.id, 47)
  assert.equal(findColorByName(ctx, '透明')?.id, 47)
  assert.equal(findColorByName(ctx, 'no such color'), null)
})

test('自由形式: 番号 色 数量', () => {
  const rows = parsePartsList('14417 黒 4\n3070b Dark Bluish Gray x6\n4x 14418 Red\n99780\n# コメント\n', ctx)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map((r) => [r.num, r.color?.id ?? null, r.qty]), [
    ['14417', 0, 4],
    ['3070b', 72, 6],
    ['14418', 4, 4],
    ['99780', null, 1],
  ])
  assert.equal(rows[0].part?.name_ja, 'ボール（横）1×2')
  assert.equal(rows[0].error, null)
})

test('自由形式: 数量が先 / 「個」 / カンマ区切り / 不明な色', () => {
  const rows = parsePartsList('2 14704 濃いグレー\n14417,Black,10\n3024 3個 みどり\n87087 ほげ色 2', ctx)
  assert.deepEqual(rows.map((r) => [r.num, r.color?.id ?? null, r.qty, r.colorText]), [
    ['14704', 72, 2, null],
    ['14417', 0, 10, null],
    ['3024', 2, 3, null],
    ['87087', null, 2, 'ほげ色'],
  ])
})

test('自由形式: カタログに無い番号もそのまま通す', () => {
  const rows = parsePartsList('x1234 Black 2\n6558 1', ctx)
  assert.equal(rows[0].num, 'x1234')
  assert.equal(rows[0].part, null)
  assert.equal(rows[0].color?.id, 0)
  assert.equal(rows[1].num, '6558')
  assert.equal(rows[1].qty, 1)
  const item = rowToCartItem(rows[0])
  assert.equal(item.bl_id, 'x1234')
  assert.equal(item.part_name_ja, 'パーツ x1234')
  assert.equal(item.bl_color_id, 11)
})

test('自由形式: 番号だけの行は色指定なし', () => {
  const item = rowToCartItem(parsePartsList('3023', ctx)[0])
  assert.equal(item.color_id, ANY_COLOR_ID)
  assert.equal(item.bl_color_id, null)
  assert.equal(item.part_name_ja, 'プレート 1×2')
})

test('自由形式: 番号が無い行はエラー', () => {
  const rows = parsePartsList('black plate', ctx)
  assert.equal(rows[0].num, null)
  assert.ok(rows[0].error)
})

test('BrickLink Wanted List XML', () => {
  const xml = `<INVENTORY>
  <ITEM><ITEMTYPE>P</ITEMTYPE><ITEMID>14417</ITEMID><COLOR>85</COLOR><MINQTY>8</MINQTY></ITEM>
  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>3070b</ITEMID>
    <MINQTY>2</MINQTY>
  </ITEM>
  <ITEM><ITEMTYPE>M</ITEMTYPE><ITEMID>sw0001</ITEMID><MINQTY>1</MINQTY></ITEM>
</INVENTORY>`
  assert.equal(detectFormat(xml), 'xml')
  const rows = parsePartsList(xml, ctx)
  assert.equal(rows.length, 3)
  assert.deepEqual([rows[0].num, rows[0].color?.id, rows[0].qty], ['14417', 72, 8])
  assert.deepEqual([rows[1].num, rows[1].color, rows[1].qty], ['3070b', null, 2])
  assert.ok(rows[2].error)
})

test('Rebrickable CSV (Part,Color,Quantity は Rebrickable 色ID)', () => {
  const csv = 'Part,Color,Quantity\n14417,0,4\n3070b,72,2\n99999,4,1\n'
  assert.equal(detectFormat(csv), 'csv')
  const rows = parsePartsList(csv, ctx)
  assert.deepEqual(
    rows.map((r) => [r.num, r.color?.id ?? null, r.qty, r.part?.num ?? null]),
    [
      ['14417', 0, 4, '14417'],
      ['3070b', 72, 2, '3070b'],
      ['99999', 4, 1, null],
    ],
  )
})

test('CSV: BrickLink 色ID列・色名列・タブ区切り', () => {
  const rows = parsePartsList('ItemID,BL Color ID,Qty\n14417,11,3\n', ctx)
  assert.equal(rows[0].color?.id, 0)
  const rows2 = parsePartsList('Part\tColor Name\tQuantity\n3023\tDark Bluish Gray\t5\n', ctx)
  assert.deepEqual([rows2[0].num, rows2[0].color?.id, rows2[0].qty], ['3023', 72, 5])
})

test('CSV: 空行・引用符', () => {
  const rows = parsePartsList('Part,Color,Quantity\n"14417","0","4"\n\n', ctx)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].qty, 4)
})

test('rowToCartItem: カタログのパーツは BrickLink ID と element を引き継ぐ', () => {
  const item = rowToCartItem(parsePartsList('14417 Black 4', ctx)[0])
  assert.equal(item.part_num, '14417')
  assert.equal(item.category, 'joint')
  assert.equal(item.color_name, '黒')
  assert.equal(item.bl_color_id, 11)
})

console.log(`\n${n} tests passed`)
