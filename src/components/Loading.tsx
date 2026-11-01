/** 読み込み中の表示。2×2 のポッチが順に灯る（index.html の起動スプラッシュと同じ形） */
export function LoadingDots({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`dots ${size === 'md' ? '' : size}`} role="img" aria-label="読み込み中">
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}

/** 画面の一部が読み込み中のときの行 */
export function Loading({ label = '読み込んでいます', inline }: { label?: string; inline?: boolean }) {
  return (
    <div className={`loading ${inline ? 'inline' : ''}`}>
      <LoadingDots size={inline ? 'sm' : 'md'} />
      <span>{label}</span>
    </div>
  )
}
