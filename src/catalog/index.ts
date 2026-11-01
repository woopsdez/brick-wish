import type { Catalog, CatalogColor, CatalogPart } from '../types'
import raw from './catalog.json'

export const catalog = raw as Catalog

const colorById = new Map<number, CatalogColor>(catalog.colors.map((c) => [c.id, c]))

export function getColor(id: number): CatalogColor | undefined {
  return colorById.get(id)
}

export function partsInCategory(categoryId: string): CatalogPart[] {
  return catalog.parts.filter((p) => p.category === categoryId).sort((a, b) => b.score - a.score)
}

export function searchParts(q: string): CatalogPart[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return catalog.parts
    .filter((p) => p.num.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.name_ja.includes(s))
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
}

export function blIdOf(part: CatalogPart): string {
  return part.bl_id ?? part.num
}
