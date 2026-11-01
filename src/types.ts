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
  /** LEGO 社の色 ID（1=白, 26=黒, 194=薄いグレー …）。国内ショップの商品キー「品番-色ID」に使う。不明なら null */
  lego_id: number | null
}

export interface CatalogCategory {
  id: string
  name_ja: string
  emoji: string
  /** 子ども向けの一言説明 */
  description?: string
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

/** 国内ショップ（ブリッカーズ）側の 1 商品。キーは「品番-LEGO色ID3桁」（例 3024-026） */
export interface ShopItem {
  /** Shopify の variant id。カート permalink に使う。不明なら null */
  variant_id: number | null
  /** 税込単価（円）。不明なら null */
  price_yen: number | null
  available: boolean
  url: string
}

export interface ShopMap {
  shop_id: string
  shop_name: string
  base_url: string
  /** 一括注文（リスト貼り付け）ページ。不明なら null でトップへ */
  list_order_url: string | null
  fetched_at: string
  /** true のときは scripts/build-shop-map.mjs --sample で作ったダミー価格 */
  sample: boolean
  items: Record<string, ShopItem>
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
  /** 簡易イラスト用のカテゴリ */
  category?: string
  /** ショップの商品キー（品番-色ID）。無ければ null */
  shop_key?: string | null
  /** カートに入れた時点の税込単価（円）。在庫なし・価格不明なら null */
  unit_yen?: number | null
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
  /** 送信時点の見積もり合計（円、送料別）。価格不明のパーツがあれば null */
  total_yen?: number | null
  /** 自動承認（月予算内）か親の手動承認か */
  approved_by?: 'auto' | 'parent' | null
  /** 全行がショップにあるときの「カートに全部入れる」URL（Shopify cart permalink）。通知のリンク先に使う */
  cart_url?: string | null
  created_at: string
  updated_at: string
}

export type Role = 'kid' | 'parent'
