import { getColor } from '../catalog'
import raw from '../catalog/shop-map.json'
import type { CartItem, CatalogPart, ShopItem, ShopMap } from '../types'

/**
 * 国内ショップ（ブリッカーズ）の在庫・価格と、カートへの誘導。
 * データは scripts/build-shop-map.mjs が作る shop-map.json（商品キーは「品番-LEGO色ID3桁」）。
 * 価格・在庫は取得時点のスナップショットで、注文時にはショップ側の表示が正。
 */
export const shopMap = raw as ShopMap

export const SHOP = {
  id: shopMap.shop_id,
  name: shopMap.shop_name,
  baseUrl: shopMap.base_url.replace(/\/$/, ''),
  listOrderUrl: shopMap.list_order_url ?? shopMap.base_url,
  /** 全国一律のゆうパケット送料と送料無料ライン（2026/11 時点の決済・配送ページより。変わり得る） */
  shippingYen: 230,
  freeShippingFromYen: 3300,
  sample: shopMap.sample,
  fetchedAt: shopMap.fetched_at,
}

export function shopKey(num: string, legoColorId: number | null): string | null {
  if (legoColorId == null) return null
  return `${num}-${String(legoColorId).padStart(3, '0')}`
}

export function shopKeyFor(num: string, colorId: number): string | null {
  return shopKey(num, getColor(colorId)?.lego_id ?? null)
}

export function shopItemFor(num: string, colorId: number): ShopItem | null {
  const key = shopKeyFor(num, colorId)
  return key ? (shopMap.items[key] ?? null) : null
}

/** 在庫ありの税込単価。扱いが無い／売り切れ／価格不明なら null */
export function unitPrice(num: string, colorId: number): number | null {
  const it = shopItemFor(num, colorId)
  return it && it.available && it.price_yen != null ? it.price_yen : null
}

/** タイル表示用：その部品で買える色の最安値 */
export function minPrice(part: CatalogPart): number | null {
  let min: number | null = null
  for (const c of part.colors) {
    const p = unitPrice(part.num, c.color_id)
    if (p != null && (min == null || p < min)) min = p
  }
  return min
}

export function productUrl(key: string): string {
  return `${SHOP.baseUrl}/products/${key}`
}

/**
 * Shopify のカート permalink（/cart/variant:qty,variant:qty）。全行に variant_id があるときだけ作れる。
 * 仕様: https://help.shopify.com/en/manual/checkout-settings/cart-permalink
 */
export function cartPermalink(items: CartItem[]): { url: string | null; missing: CartItem[] } {
  const parts: string[] = []
  const missing: CartItem[] = []
  for (const i of items) {
    const it = i.shop_key ? shopMap.items[i.shop_key] : null
    if (it?.variant_id != null && it.available) parts.push(`${it.variant_id}:${i.qty}`)
    else missing.push(i)
  }
  return { url: missing.length === 0 && parts.length ? `${SHOP.baseUrl}/cart/${parts.join(',')}` : null, missing }
}

/** 一括注文（リスト貼り付け）用の文字列。1 行「品番-色ID<TAB>数量」。ショップ側の受け付け形式は未確認 */
export function orderListText(items: CartItem[]): string {
  return items.map((i) => `${i.shop_key ?? i.part_num}\t${i.qty}`).join('\n')
}

export function shippingFor(totalYen: number): number {
  return totalYen >= SHOP.freeShippingFromYen ? 0 : SHOP.shippingYen
}
