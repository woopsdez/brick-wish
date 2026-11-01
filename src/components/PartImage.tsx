import { useState } from 'react'
import { partImageFallbackUrl, partImageUrl } from '../lib/images'

interface Props {
  partNum: string
  colorId: number
  elementId: string | null
  rgb?: string
  alt: string
  className?: string
}

/** 画像が無い色のときは色付きのプレースホルダに落とす */
export function PartImage({ partNum, colorId, elementId, rgb, alt, className }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const part = { num: partNum }
  if (stage === 2) {
    return (
      <div className={`part-img placeholder ${className ?? ''}`} style={{ background: rgb ? `#${rgb}` : '#ddd' }} aria-label={alt}>
        <span>{partNum}</span>
      </div>
    )
  }
  const src = stage === 0 ? partImageUrl(part, colorId, elementId) : partImageFallbackUrl(part, colorId)
  return (
    <img
      className={`part-img ${className ?? ''}`}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setStage((s) => (s === 0 && elementId ? 1 : 2))}
    />
  )
}
