import { useState } from 'react'
import { partImageFallbackUrl, partImageUrl } from '../lib/images'
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
 * 下に簡易イラスト（PartGlyph）、上に Rebrickable の写真。写真が読めた時だけ写真を見せる。
 * CDN が遮断された環境（claude.ai の artifact など）でもイラストで色と形が分かる。
 */
export function PartImage({ partNum, colorId, elementId, rgb = 'A0A5A9', isTrans, category = 'basic', alt, className }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [loaded, setLoaded] = useState(false)
  const part = { num: partNum }
  const src = stage === 0 ? partImageUrl(part, colorId, elementId) : stage === 1 ? partImageFallbackUrl(part, colorId) : null
  return (
    <div className={`part-img ${className ?? ''}`} role="img" aria-label={alt}>
      <PartGlyph category={category} rgb={rgb} isTrans={isTrans} />
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
