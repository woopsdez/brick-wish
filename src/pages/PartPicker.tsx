import { useState } from 'react'
import { blIdOf, getColor } from '../catalog'
import { ColorSwatch } from '../components/ColorSwatch'
import { Icon } from '../components/Icon'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { yen } from '../lib/budget'
import { SHOP, productUrl, shopKeyFor, unitPrice } from '../lib/shop'
import { addToCart } from '../store/cart'
import type { CatalogPart } from '../types'

/**
 * 色と数量を選んでカートへ。
 * priceless = 価格を取得していないパーツ（「ぜんぶ」タブ）。価格が分かる色はそのまま出し、分からない色は
 *             「在庫なし」ではなく「保護者が商品ページで確認」と案内する
 */
export function PartPicker({ part, onClose, priceless }: { part: CatalogPart; onClose: () => void; priceless?: boolean }) {
  const colors = part.colors.map((pc) => ({ pc, color: getColor(pc.color_id), price: unitPrice(part.num, pc.color_id) })).filter((x) => x.color)
  // 価格が分かる色を先に並べる
  colors.sort((a, b) => (a.price == null ? 1 : 0) - (b.price == null ? 1 : 0))
  const [idx, setIdx] = useState(0)
  const [qty, setQty] = useState(4)
  const [added, setAdded] = useState(false)
  const sel = colors[idx]
  const shopKey = sel?.color ? shopKeyFor(part.num, sel.color.id) : null

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
      category: part.category,
      shop_key: shopKey,
      unit_yen: sel.price,
      qty,
    })
    setAdded(true)
    setTimeout(onClose, 600)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={part.name_ja} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="閉じる">
          <Icon name="close" size={18} />
        </button>
        <div className="picker-top">
          {sel?.color && (
            <PartImage partNum={part.num} colorId={sel.color.id} elementId={sel.pc.element_id} rgb={sel.color.rgb} isTrans={sel.color.is_trans} category={part.category} alt={part.name_ja} className="big" />
          )}
          <div>
            <h2>{part.name_ja}</h2>
            <p className="muted">
              {part.name_ja !== part.name && <>{part.name} · </>}
              {part.num}
            </p>
            {sel?.color && <p className="color-name">色：{sel.color.name_ja}</p>}
            {sel &&
              (sel.price != null ? (
                <p className="price">
                  {yen(sel.price)} / 個 × {qty} = <strong>{yen(sel.price * qty)}</strong>
                </p>
              ) : priceless ? (
                <>
                  <p className="muted small">この色の価格は未確認です。保護者が{SHOP.name}の商品ページで確かめるので、送ると「承認待ち」になります。</p>
                  {shopKey && (
                    <a className="ext" href={productUrl(shopKey)} target="_blank" rel="noopener noreferrer">
                      {SHOP.name}の商品ページ <Icon name="external" size={14} />
                    </a>
                  )}
                </>
              ) : (
                <p className="warn">{SHOP.name}に在庫なし。入れると保護者の確認が必要になります</p>
              ))}
          </div>
        </div>

        <div className="swatches">
          {colors.map((x, i) => (
            <div key={x.color!.id} className={`swatch-wrap ${!priceless && x.price == null ? 'soldout' : ''}`}>
              <ColorSwatch color={x.color!} selected={i === idx} onClick={() => setIdx(i)} />
              <span className="swatch-price">{x.price != null ? yen(x.price) : priceless ? '?' : '×'}</span>
            </div>
          ))}
        </div>

        <div className="picker-bottom">
          <QtyStepper value={qty} onChange={setQty} big />
          <button className={`btn btn-big btn-kid ${added ? 'done' : ''}`} onClick={add} disabled={added}>
            {added ? (
              <>
                <Icon name="check" size={18} />
                追加しました
              </>
            ) : (
              'カートに入れる'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
