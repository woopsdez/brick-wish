import type { CartItem } from '../types'

/**
 * BrickLink Wanted List アップロード用 XML。
 * 仕様: https://www.bricklink.com/help.asp?helpID=207
 *  - ITEMTYPE: P = Part
 *  - COLOR 省略可（省略すると「色指定なし」）
 *  - MINQTY: 欲しい数
 *  - CONDITION: N=New / U=Used / 省略=どちらでも
 */
export function buildWantedListXml(items: CartItem[], opts: { condition?: 'N' | 'U' | null; remarks?: string } = {}): string {
  const merged = mergeItems(items)
  const lines: string[] = ['<INVENTORY>']
  for (const it of merged) {
    lines.push('  <ITEM>')
    lines.push('    <ITEMTYPE>P</ITEMTYPE>')
    lines.push(`    <ITEMID>${esc(it.bl_id)}</ITEMID>`)
    if (it.bl_color_id != null) lines.push(`    <COLOR>${it.bl_color_id}</COLOR>`)
    lines.push(`    <MINQTY>${it.qty}</MINQTY>`)
    if (opts.condition) lines.push(`    <CONDITION>${opts.condition}</CONDITION>`)
    if (opts.remarks) lines.push(`    <REMARKS>${esc(opts.remarks)}</REMARKS>`)
    lines.push('  </ITEM>')
  }
  lines.push('</INVENTORY>')
  return lines.join('\n')
}

/** 同じパーツ×色をまとめる */
export function mergeItems(items: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>()
  for (const it of items) {
    const key = `${it.bl_id}|${it.bl_color_id ?? ''}`
    const cur = map.get(key)
    if (cur) cur.qty += it.qty
    else map.set(key, { ...it })
  }
  return Array.from(map.values())
}

/** LEGO Pick a Brick のリストアップロード用 CSV（elementId,quantity）。element_id が無い行は除外 */
export function buildPickABrickCsv(items: CartItem[]): { csv: string; skipped: CartItem[] } {
  const skipped: CartItem[] = []
  const rows: string[] = ['elementId,quantity']
  for (const it of mergeItems(items)) {
    if (!it.element_id) {
      skipped.push(it)
      continue
    }
    rows.push(`${it.element_id},${it.qty}`)
  }
  return { csv: rows.join('\n'), skipped }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
