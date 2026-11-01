import type { CatalogColor } from '../types'

interface Props {
  color: CatalogColor
  selected?: boolean
  onClick?: () => void
  size?: number
}

export function ColorSwatch({ color, selected, onClick, size = 48 }: Props) {
  return (
    <button
      type="button"
      className={`swatch ${selected ? 'selected' : ''} ${color.is_trans ? 'trans' : ''}`}
      style={{ background: `#${color.rgb}`, width: size, height: size }}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={color.name_ja}
      title={`${color.name_ja} / ${color.name}`}
    />
  )
}
