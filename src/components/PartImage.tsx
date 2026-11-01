import { useState } from 'react'
import { partImageFallbackUrl, partImageUrl } from '../lib/images'
import { LoadingDots } from './Loading'
import { PartGlyph } from './PartGlyph'

interface Props {
  partNum: string
  colorId: number
  elementId: string | null
  rgb?: string
  isTrans?: boolean
  category?: string
  alt: string
  className?: string
}

/**
 * 明るい標本箱に Rebrickable の写真を載せる。
 *  - 読み込み中: シマー＋ポッチのローディング
 *  - 写真が読めた: 写真（白背景は箱の色に溶ける）
 *  - 全部失敗（CDN 遮断など）: 簡易イラスト（PartGlyph）
 */
export function PartImage({ partNum, colorId, elementId, rgb = 'A0A5A9', isTrans, category = 'basic', alt, className }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [loaded, setLoaded] = useState(false)
  const part = { num: partNum }
  const src = stage === 0 ? partImageUrl(part, colorId, elementId) : stage === 1 ? partImageFallbackUrl(part, colorId) : null
  const failed = stage === 2
  const loading = !loaded && !failed
  return (
    <div className={`part-img ${className ?? ''} ${loading ? 'is-loading' : ''}`} role="img" aria-label={alt} aria-busy={loading || undefined}>
      {failed && <PartGlyph category={category} rgb={rgb} isTrans={isTrans} />}
      {loading && (
        <span className="part-skel" aria-hidden="true">
          <LoadingDots size="sm" />
        </span>
      )}
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setStage((s) => (s === 0 && elementId ? 1 : 2))
          }}
        />
      )}
    </div>
  )
}
