/** Rebrickable 由来のカタログ型。scripts/build-catalog.mjs が生成する。 */
export interface CatalogColor {
  /** Rebrickable color id */
  id: number
  name: string
  /** 子ども向け表示名 */
  name_ja: string
  rgb: string
  is_trans: boolean
  /** BrickLink color id。不明なら null（Wanted List では色指定なしになる） */
  bl_id: number | null
}

export interface CatalogCategory {
  id: string
  name_ja: string
  emoji: string
}

export interface CatalogPartColor {
  /** Rebrickable color id */
  color_id: number
  /** Rebrickable element id。画像 URL と Pick a Brick 用。無ければ null */
  element_id: string | null
}

export interface CatalogPart {
  /** Rebrickable part_num */
  num: string
  name: string
  name_ja: string
  category: string
  /** BrickLink item id。不明なら part_num を使う */
  bl_id: string | null
  colors: CatalogPartColor[]
  /** 人気順スコア（セット収録回数など）。並び替え用 */
  score: number
}

export interface Catalog {
  generated_at: string
  source: string
  colors: CatalogColor[]
  categories: CatalogCategory[]
  parts: CatalogPart[]
}

/** カートに入れる 1 行 */
export interface CartItem {
  part_num: string
  part_name: string
  part_name_ja: string
  bl_id: string
  color_id: number
  color_name: string
  color_rgb: string
  bl_color_id: number | null
  element_id: string | null
  qty: number
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered'

export interface WishRequest {
  id: string
  family_id: string
  kid_name: string
  note: string
  items: CartItem[]
  status: RequestStatus
  parent_note: string
  created_at: string
  updated_at: string
}

export type Role = 'kid' | 'parent'
