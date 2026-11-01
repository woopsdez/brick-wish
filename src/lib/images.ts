import type { CatalogPart } from '../types'

/**
 * 画像は Rebrickable CDN を直接参照する（ホットリンク）。
 * 利用規約上の可否は未確認。本番運用するなら build-catalog で画像をダウンロードして
 * 自サイトに同梱するか、Rebrickable に確認すること。
 */
export function partImageUrl(part: Pick<CatalogPart, 'num'>, colorId: number, elementId: string | null): string {
  if (elementId) return `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
  return `https://cdn.rebrickable.com/media/parts/ldraw/${colorId}/${part.num}.png`
}

export function partImageFallbackUrl(part: Pick<CatalogPart, 'num'>, colorId: number): string {
  return `https://cdn.rebrickable.com/media/parts/ldraw/${colorId}/${part.num}.png`
}
