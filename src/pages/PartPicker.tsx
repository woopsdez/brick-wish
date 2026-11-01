import { useState } from 'react'
import { blIdOf, getColor } from '../catalog'
import { ColorSwatch } from '../components/ColorSwatch'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { addToCart } from '../store/cart'
import type { CatalogPart } from '../types'

export function PartPicker({ part, onClose }: { part: CatalogPart; onClose: () => void }) {
  const colors = part.colors.map((pc) => ({ pc, color: getColor(pc.color_id) })).filter((x) => x.color)
  const [idx, setIdx] = useState(0)
  const [qty, setQty] = useState(4)
  const [added, setAdded] = useState(false)
  const sel = colors[idx]

  function add() {
    if (!sel?.color) return
    addToCart({
      part_num: part.num,
      part_name: part.name,
      part_name_ja: part.name_ja,
      bl_id: blIdOf(part),
      color_id: sel.color.id,
      color_name: sel.color.name_ja,
      color_rgb: sel.color.rgb,
      bl_color_id: sel.color.bl_id,
      element_id: sel.pc.element_id,
      qty,
    })
    setAdded(true)
    setTimeout(onClose, 600)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={part.name_ja} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
        <div className="picker-top">
          {sel?.color && (
            <PartImage partNum={part.num} colorId={sel.color.id} elementId={sel.pc.element_id} rgb={sel.color.rgb} alt={part.name_ja} className="big" />
          )}
          <div>
            <h2>{part.name_ja}</h2>
            <p className="muted">
              {part.name} · {part.num}
            </p>
            {sel?.color && <p className="color-name">色：{sel.color.name_ja}</p>}
          </div>
        </div>

        <div className="swatches">
          {colors.map((x, i) => (
            <ColorSwatch key={x.color!.id} color={x.color!} selected={i === idx} onClick={() => setIdx(i)} />
          ))}
        </div>

        <div className="picker-bottom">
          <QtyStepper value={qty} onChange={setQty} big />
          <button className={`btn btn-big btn-kid ${added ? 'done' : ''}`} onClick={add} disabled={added}>
            {added ? '✓ 追加しました' : 'カートに入れる'}
          </button>
        </div>
      </div>
    </div>
  )
}
