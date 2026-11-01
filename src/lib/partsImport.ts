import type { CartItem, CatalogColor, CatalogPart } from '../types'

/**
 * パーツリストの貼り付け取り込み。
 * カタログ（catalog.json）に無い番号でも、BrickLink の番号としてそのままカートに入れられるようにする。
 *
 * 対応形式（detectFormat で自動判定）:
 *  - xml   : BrickLink Wanted List XML（<ITEM><ITEMID>…<COLOR>…<MINQTY>…）。COLOR は BrickLink 色 ID
 *  - csv   : ヘッダ付き CSV。Rebrickable の "Part,Color,Quantity"（Color は Rebrickable 色 ID）や
 *            "ItemID,ColorID,Qty" 系。ヘッダに bl / bricklink を含む色列は BrickLink 色 ID として読む
 *  - lines : 1 行 1 パーツの自由形式。「14417 黒 4」「14417 x4 Black」「4x 14417 Dark Bluish Gray」など
 *
 * このモジュールは純粋関数だけで、カタログは引数で受け取る（scripts/test-parts-import.ts から node で直接テストするため）。
 */

export interface ImportContext {
  colors: CatalogColor[]
  parts: CatalogPart[]
}

export interface ImportRow {
  /** 元の行・要素（表示用） */
  source: string
  /** 読み取ったパーツ番号。無ければ null（error に理由） */
  num: string | null
  qty: number
  /** 解決できた色。null は「指定なし」 */
  color: CatalogColor | null
  /** 色として読んだが解決できなかった文字列 */
  colorText: string | null
  /** カタログに載っていればそのパーツ */
  part: CatalogPart | null
  error: string | null
}

/** 「色指定なし」を表す color_id。カタログの色 ID（Rebrickable）は 0 以上なので負数を使う */
export const ANY_COLOR_ID = -1
export const ANY_COLOR_RGB = 'E6E6E6'

export function isAnyColor(item: Pick<CartItem, 'color_id'>): boolean {
  return item.color_id === ANY_COLOR_ID
}

/** BrickLink / LEGO のパーツ番号らしい文字列か（例: 14417, 3070b, 3829c01, x1234） */
export function looksLikePartNum(s: string): boolean {
  return /^[a-z]{0,2}\d{2,7}[a-z]{0,4}\d{0,3}$/i.test(s) && /\d{2,}/.test(s)
}

export type ImportFormat = 'xml' | 'csv' | 'lines'

export function detectFormat(text: string): ImportFormat {
  const t = text.trim()
  if (/<\s*ITEM\b/i.test(t) && /<\s*ITEMID\b/i.test(t)) return 'xml'
  const first = t.split(/\r?\n/).find((l) => l.trim()) ?? ''
  if (/[,\t]/.test(first) && !/\d{3,}/.test(first.split(/[,\t]/)[0] ?? '') && /part|item|colou?r|qty|quantity/i.test(first)) return 'csv'
  return 'lines'
}

export function parsePartsList(text: string, ctx: ImportContext): ImportRow[] {
  const fmt = detectFormat(text)
  const rows = fmt === 'xml' ? parseXml(text, ctx) : fmt === 'csv' ? parseCsv(text, ctx) : parseLines(text, ctx)
  return rows
}

// ---------------------------------------------------------------- XML

function parseXml(text: string, ctx: ImportContext): ImportRow[] {
  const rows: ImportRow[] = []
  const itemRe = /<\s*ITEM\s*>([\s\S]*?)<\s*\/\s*ITEM\s*>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(text))) {
    const body = m[1]
    const type = tag(body, 'ITEMTYPE')
    const id = tag(body, 'ITEMID')
    const colorRaw = tag(body, 'COLOR')
    const qtyRaw = tag(body, 'MINQTY') ?? tag(body, 'QTY')
    const source = `${id ?? '?'}${colorRaw ? ` / color ${colorRaw}` : ''}${qtyRaw ? ` × ${qtyRaw}` : ''}`
    if (type && type.toUpperCase() !== 'P') {
      rows.push(empty(source, `パーツ以外（ITEMTYPE=${type}）は取り込めません`))
      continue
    }
    if (!id) {
      rows.push(empty(source, 'ITEMID がありません'))
      continue
    }
    const color = colorRaw ? findColorByBlId(ctx, colorRaw) : null
    rows.push(finish(ctx, source, id, parseQty(qtyRaw) ?? 1, color, colorRaw && !color ? colorRaw : null))
  }
  if (rows.length === 0) rows.push(empty(text.slice(0, 40), '<ITEM> が見つかりません'))
  return rows
}

function tag(body: string, name: string): string | null {
  const m = new RegExp(`<\\s*${name}\\s*>([^<]*)<`, 'i').exec(body)
  return m ? m[1].trim() : null
}

// ---------------------------------------------------------------- CSV

function parseCsv(text: string, ctx: ImportContext): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase())
  const col = (re: RegExp) => header.findIndex((h) => re.test(h))
  const iPart = col(/^(part|part ?num|part_num|partno|item|item ?id|itemid|item ?no|design ?id|number|no\.?|bl ?id)$/)
  const iColor = col(/colou?r/)
  const iQty = col(/^(qty|quantity|minqty|count|amount|pcs|個数|数量)$/)
  if (iPart < 0) return [empty(lines[0], 'パーツ番号の列（Part / ItemID など）が見つかりません')]
  const colorIsBl = iColor >= 0 && /bl|bricklink/.test(header[iColor])
  const rows: ImportRow[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line)
    const num = (cells[iPart] ?? '').trim()
    if (!num) {
      rows.push(empty(line, 'パーツ番号が空です'))
      continue
    }
    const colorRaw = iColor >= 0 ? (cells[iColor] ?? '').trim() : ''
    let color: CatalogColor | null = null
    if (colorRaw) {
      if (/^\d+$/.test(colorRaw)) color = colorIsBl ? findColorByBlId(ctx, colorRaw) : findColorByRbId(ctx, colorRaw)
      else color = findColorByName(ctx, colorRaw)
    }
    const qty = iQty >= 0 ? parseQty(cells[iQty]) : null
    rows.push(finish(ctx, line, num, qty ?? 1, color, colorRaw && !color ? colorRaw : null))
  }
  return rows
}

function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
    } else if ((ch === ',' || ch === '\t') && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// ---------------------------------------------------------------- 自由形式

function parseLines(text: string, ctx: ImportContext): ImportRow[] {
  const rows: ImportRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    rows.push(parseLine(line, ctx))
  }
  if (rows.length === 0) rows.push(empty('', '何も入力されていません'))
  return rows
}

function parseLine(line: string, ctx: ImportContext): ImportRow {
  const tokens = line
    .split(/[\s,;、，\t]+/)
    .map((t) => t.replace(/^[(（[]|[)）\]]$/g, ''))
    .filter(Boolean)
  let qty: number | null = null
  let num: string | null = null
  const rest: string[] = []
  const ints: string[] = []

  for (const t of tokens) {
    if (/^[x×]$/i.test(t)) continue
    const q = /^(?:[x×])(\d{1,3})$/i.exec(t) ?? /^(\d{1,3})(?:[x×]|個|コ|pcs?|pc)$/i.exec(t)
    if (q && qty == null) {
      qty = parseInt(q[1], 10)
      continue
    }
    if (/^\d+$/.test(t)) {
      ints.push(t)
      continue
    }
    if (looksLikePartNum(t) && !num && !/^[a-z]+$/i.test(t)) {
      num = t
      continue
    }
    rest.push(t)
  }

  // 整数トークン: カタログにあるもの → 無ければ桁数が多いもの（≥3桁）をパーツ番号、残りの 1 つを数量に
  if (!num && ints.length) {
    const hit = ints.find((n) => findPart(ctx, n))
    const pick = hit ?? ints.filter((n) => n.length >= 3).sort((a, b) => b.length - a.length)[0] ?? null
    if (pick) {
      num = pick
      ints.splice(ints.indexOf(pick), 1)
    }
  }
  if (qty == null && ints.length === 1 && ints[0].length <= 3) qty = parseInt(ints[0], 10)
  else if (ints.length) rest.push(...ints)

  if (!num) return empty(line, 'パーツ番号が見つかりません')
  const colorText = rest.join(' ').trim()
  const color = colorText ? findColorByName(ctx, colorText) : null
  return finish(ctx, line, num, qty ?? 1, color, colorText && !color ? colorText : null)
}

// ---------------------------------------------------------------- 共通

function empty(source: string, error: string): ImportRow {
  return { source, num: null, qty: 0, color: null, colorText: null, part: null, error }
}

function finish(ctx: ImportContext, source: string, num: string, qty: number, color: CatalogColor | null, colorText: string | null): ImportRow {
  const part = findPart(ctx, num)
  return {
    source,
    num: part?.num ?? num.trim(),
    qty: Math.min(999, Math.max(1, qty)),
    color,
    colorText,
    part,
    error: null,
  }
}

function parseQty(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseInt(s.replace(/[^\d]/g, ''), 10)
  return Number.isNaN(n) || n <= 0 ? null : n
}

export function findPart(ctx: ImportContext, num: string): CatalogPart | null {
  const s = num.trim().toLowerCase()
  if (!s) return null
  return ctx.parts.find((p) => p.num.toLowerCase() === s || (p.bl_id && p.bl_id.toLowerCase() === s)) ?? null
}

export function findColorByBlId(ctx: ImportContext, id: string | number): CatalogColor | null {
  const n = typeof id === 'number' ? id : parseInt(id, 10)
  if (Number.isNaN(n)) return null
  return ctx.colors.find((c) => c.bl_id === n) ?? null
}

export function findColorByRbId(ctx: ImportContext, id: string | number): CatalogColor | null {
  const n = typeof id === 'number' ? id : parseInt(id, 10)
  if (Number.isNaN(n)) return null
  return ctx.colors.find((c) => c.id === n) ?? null
}

/** 日本語の通称・BrickLink 略称 → カタログの英語名。normalizeColorName 後のキーで引く */
const COLOR_ALIASES: Record<string, string> = {
  ブラック: 'black',
  くろ: 'black',
  ホワイト: 'white',
  しろ: 'white',
  レッド: 'red',
  あか: 'red',
  ブルー: 'blue',
  あお: 'blue',
  イエロー: 'yellow',
  きいろ: 'yellow',
  グリーン: 'green',
  みどり: 'green',
  ライム: 'lime',
  タン: 'tan',
  ダークタン: 'darktan',
  ブラウン: 'reddishbrown',
  茶: 'reddishbrown',
  ちゃいろ: 'reddishbrown',
  グレー: 'lightbluishgray',
  灰色: 'lightbluishgray',
  ライトグレー: 'lightbluishgray',
  薄グレー: 'lightbluishgray',
  明るいグレー: 'lightbluishgray',
  ダークグレー: 'darkbluishgray',
  濃グレー: 'darkbluishgray',
  暗いグレー: 'darkbluishgray',
  lbg: 'lightbluishgray',
  dbg: 'darkbluishgray',
  lightgray: 'lightbluishgray',
  darkgray: 'darkbluishgray',
  bluishgray: 'lightbluishgray',
  ダークブルー: 'darkblue',
  紺: 'darkblue',
  ダークレッド: 'darkred',
  ダークグリーン: 'darkgreen',
  ピンク: 'brightpink',
  パープル: 'darkpurple',
  むらさき: 'darkpurple',
  シルバー: 'flatsilver',
  ゴールド: 'pearlgold',
  クリア: 'transclear',
  透明: 'transclear',
  とうめい: 'transclear',
  ブライトライトオレンジ: 'brightlightorange',
  ミディアムブルー: 'mediumblue',
  ダークアズール: 'darkazure',
  ミディアムアズール: 'mediumazure',
  brightlightorange: 'brightlightorange',
}

export function normalizeColorName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bgrey\b/g, 'gray')
    .replace(/\blt\.?\s*/g, 'light')
    .replace(/\bdk\.?\s*/g, 'dark')
    .replace(/\bmed\.?\s*/g, 'medium')
    .replace(/\btr\.?\s*/g, 'trans')
    .replace(/[\s\-_・/()（）]/g, '')
}

export function findColorByName(ctx: ImportContext, name: string): CatalogColor | null {
  const raw = name.trim()
  if (!raw) return null
  const key = normalizeColorName(raw)
  const aliased = COLOR_ALIASES[key] ?? COLOR_ALIASES[raw] ?? key
  for (const c of ctx.colors) {
    if (normalizeColorName(c.name) === aliased) return c
  }
  for (const c of ctx.colors) {
    if (normalizeColorName(c.name_ja) === key || c.name_ja === raw) return c
  }
  // 「Trans Clear」「trans-clear」などの表記ゆれ / 前方一致（Dark Bluish Gray ⊃ Dark Bluish）
  for (const c of ctx.colors) {
    const n = normalizeColorName(c.name)
    if (n.startsWith(aliased) && aliased.length >= 4) return c
  }
  return null
}

/** 取り込み行 → カート行。カタログに無い番号は BrickLink の番号としてそのまま使う */
export function rowToCartItem(row: ImportRow): CartItem {
  if (!row.num) throw new Error(row.error ?? 'パーツ番号がありません')
  const part = row.part
  const color = row.color
  const element = part && color ? (part.colors.find((c) => c.color_id === color.id)?.element_id ?? null) : null
  return {
    part_num: part?.num ?? row.num,
    part_name: part?.name ?? `Part ${row.num}`,
    part_name_ja: part?.name_ja ?? `パーツ ${row.num}`,
    bl_id: part ? (part.bl_id ?? part.num) : row.num,
    color_id: color?.id ?? ANY_COLOR_ID,
    color_name: color?.name_ja ?? '色指定なし',
    color_rgb: color?.rgb ?? ANY_COLOR_RGB,
    bl_color_id: color?.bl_id ?? null,
    element_id: element,
    category: part?.category ?? 'basic',
    qty: row.qty,
  }
}
