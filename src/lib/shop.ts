import { catalog, getColor } from '../catalog'
import sampleMap from '../catalog/shop-map.json'
import type { CartItem, CatalogPart, ShopItem, ShopMap } from '../types'

/**
 * 国内ショップ（ブリッカーズ）の在庫・価格と、カートへの誘導。
 * データは scripts/build-shop-map.mjs が作る（商品キーは「品番-LEGO色ID3桁」）。
 * - shop-map.json: リポジトリに入っている本物の価格・在庫（ブリッカーズの許可済み、2026-11-01）
 * - shop-map.local.json: 手元での上書き用（gitignore）。あればこちらを優先する
 * 価格・在庫は取得時点のスナップショットで、注文時にはショップ側の表示が正。
 */
const localMaps = import.meta.glob<{ default: ShopMap }>('../catalog/shop-map.local.json', { eager: true })
export const shopMap: ShopMap = Object.values(localMaps)[0]?.default ?? (sampleMap as ShopMap)

export const SHOP = {
  id: shopMap.shop_id,
  name: shopMap.shop_name,
  baseUrl: shopMap.base_url.replace(/\/$/, ''),
  listOrderUrl: shopMap.list_order_url ?? shopMap.base_url,
  /** ゆうパケット送料・送料無料ライン・500 円未満の少額手数料（2026/11/01 の決済・配送ページより。変わり得る） */
  shippingYen: 230,
  freeShippingFromYen: 3300,
  smallOrderBelowYen: 500,
  smallOrderFeeYen: 100,
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

const curatedNums = new Set(catalog.parts.map((p) => p.num))

/**
 * 価格の状態。
 *  known     = 価格あり
 *  soldout   = ショップに無い／売り切れ（厳選カタログの部品×色はすべて取得済みなので、無ければ扱いが無い）
 *  unchecked = 取得していない（「ぜんぶ」タブのパーツ。商品ページで確認する）
 */
export function priceStatus(num: string, colorId: number): 'known' | 'soldout' | 'unchecked' {
  const key = shopKeyFor(num, colorId)
  if (!key) return 'unchecked'
  const it = shopMap.items[key]
  if (it) return it.available && it.price_yen != null ? 'known' : 'soldout'
  return curatedNums.has(num) ? 'soldout' : 'unchecked'
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

/** 送料（少額手数料込み）。商品合計 3,300 円以上は無料、500 円未満は送料に 100 円が足される */
export function shippingFor(totalYen: number): number {
  if (totalYen >= SHOP.freeShippingFromYen) return 0
  return SHOP.shippingYen + (totalYen < SHOP.smallOrderBelowYen ? SHOP.smallOrderFeeYen : 0)
}
