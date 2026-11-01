import type { CatalogPart } from '../types'

/** 「ぜんぶ」タブ用の全パーツ索引（public/all-parts.json、scripts/build-all-parts.mjs が生成）。開いたときだけ読む */
export interface AllPartsCategory {
  id: number
  name: string
  name_ja: string
  /** 画像が無いときのイラスト種別（PartGlyph の category） */
  glyph: string
}

export interface AllPart {
  num: string
  name: string
  cat: number
  /** 収録セット数（人気順の目安） */
  sets: number
  colors: { color_id: number; element_id: string | null }[]
}

export interface AllPartsIndex {
  generated_at: string
  source: string
  min_year: number
  categories: AllPartsCategory[]
  parts: AllPart[]
  byCat: Map<number, AllPartsCategory>
}

type Raw = {
  generated_at: string
  source: string
  min_year: number
  categories: AllPartsCategory[]
  parts: [string, string, number, number, [number, string | null][]][]
}

let cache: Promise<AllPartsIndex> | null = null

export function loadAllParts(): Promise<AllPartsIndex> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}all-parts.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`all-parts.json: ${res.status}`)
        return res.json() as Promise<Raw>
      })
      .then((raw) => ({
        generated_at: raw.generated_at,
        source: raw.source,
        min_year: raw.min_year,
        categories: raw.categories,
        byCat: new Map(raw.categories.map((c) => [c.id, c])),
        parts: raw.parts.map(([num, name, cat, sets, colors]) => ({
          num,
          name,
          cat,
          sets,
          colors: colors.map(([color_id, element_id]) => ({ color_id, element_id })),
        })),
      }))
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

/** 番号は前方一致を優先、名前は単語ごとの部分一致（英語）。人気順 */
export function searchAllParts(index: AllPartsIndex, q: string, cat: number | null, limit = 60): AllPart[] {
  const s = q.trim().toLowerCase()
  const words = s.split(/\s+/).filter(Boolean)
  const pool = cat == null ? index.parts : index.parts.filter((p) => p.cat === cat)
  if (!words.length) return pool.slice(0, limit)
  const scored: [number, AllPart][] = []
  for (const p of pool) {
    const num = p.num.toLowerCase()
    const name = p.name.toLowerCase()
    let score = 0
    if (num === s) score = 1000
    else if (num.startsWith(s)) score = 500
    else if (words.every((w) => name.includes(w) || num.includes(w))) score = 100
    if (score) scored.push([score + Math.min(99, p.sets), p])
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map((x) => x[1])
}

/** PartPicker / カートが使うカタログ形式に合わせる。日本語名は無いので英名を入れる */
export function toCatalogPart(p: AllPart, index: AllPartsIndex): CatalogPart {
  return {
    num: p.num,
    name: p.name,
    name_ja: p.name,
    category: index.byCat.get(p.cat)?.glyph ?? 'basic',
    bl_id: null,
    colors: p.colors,
    score: p.sets,
  }
}
