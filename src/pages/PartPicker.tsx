import { useState } from 'react'
import { blIdOf, getColor } from '../catalog'
import { ColorSwatch } from '../components/ColorSwatch'
import { Icon } from '../components/Icon'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { decideApproval, estimateTotal, yen } from '../lib/budget'
import { SHOP, productUrl, shopKeyFor, unitPrice } from '../lib/shop'
import { addToCart, cartKey, useCart } from '../store/cart'
import { useFamily } from '../store/family-hooks'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'
import type { CartItem, CatalogColor, CatalogPart, CatalogPartColor } from '../types'

type Choice = { pc: CatalogPartColor; color: CatalogColor; price: number | null }

function toCartItem(part: CatalogPart, sel: Choice, qty: number): CartItem {
  return {
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
    shop_key: shopKeyFor(part.num, sel.color.id),
    unit_yen: sel.price,
    qty,
  }
}

/**
 * 色と数量を選んでカートへ。入れた後のカート合計と、今月の枠に収まるか（自動 OK になるか）もここで見せる。
 * priceless = 価格を取得していないパーツ（「ぜんぶ」タブ）。価格が分かる色はそのまま出し、分からない色は
 *             「在庫なし」ではなく「保護者が商品ページで確認」と案内する
 */
export function PartPicker({ part, onClose, priceless }: { part: CatalogPart; onClose: () => void; priceless?: boolean }) {
  const colors: Choice[] = part.colors
    .map((pc) => ({ pc, color: getColor(pc.color_id), price: unitPrice(part.num, pc.color_id) }))
    .filter((x): x is Choice => x.color != null)
  // 価格が分かる色を先に並べる
  colors.sort((a, b) => (a.price == null ? 1 : 0) - (b.price == null ? 1 : 0))
  const [idx, setIdx] = useState(0)
  const [qty, setQty] = useState(4)
  const [added, setAdded] = useState(false)
  const sel = colors[idx]
  const shopKey = sel ? shopKeyFor(part.num, sel.color.id) : null

  // 入れた後のカートで、合計と自動承認の判定を先に見せる
  const cart = useCart()
  const familyId = useFamilyId()
  const { family } = useFamily(familyId)
  const { requests } = useRequests(familyId)
  const preview = (() => {
    if (!sel) return null
    const item = toCartItem(part, sel, qty)
    const key = cartKey(item)
    const merged = cart.some((i) => cartKey(i) === key) ? cart.map((i) => (cartKey(i) === key ? { ...i, qty: Math.min(999, i.qty + qty) } : i)) : [...cart, item]
    return { count: merged.reduce((n, i) => n + i.qty, 0), total: estimateTotal(merged).total, decision: decideApproval(family, requests, merged) }
  })()

  function add() {
    if (!sel) return
    addToCart(toCartItem(part, sel, qty))
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
          {sel && (
            <PartImage partNum={part.num} colorId={sel.color.id} elementId={sel.pc.element_id} rgb={sel.color.rgb} isTrans={sel.color.is_trans} category={part.category} alt={part.name_ja} className="big" />
          )}
          <div>
            <h2>{part.name_ja}</h2>
            <p className="muted">
              {part.name_ja !== part.name && <>{part.name} · </>}
              {part.num}
            </p>
            {sel && <p className="color-name">色：{sel.color.name_ja}</p>}
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
            {preview && (
              <p className={`cart-preview ${preview.decision.status === 'approved' ? 'ok' : 'warn'}`}>
                入れるとカート {preview.count} 個・合計 <strong>{preview.total != null ? yen(preview.total) : '価格未確認あり'}</strong>
                {preview.decision.status === 'approved' && ` · 枠の残り ${yen(preview.decision.remaining - preview.decision.total_yen)}、送るとすぐ OK`}
                {preview.decision.status === 'pending' && preview.decision.reason === 'over_budget' && ` · 今月の枠を ${yen((preview.total ?? 0) - preview.decision.remaining)} 超えるので保護者の承認`}
                {preview.decision.status === 'pending' && preview.decision.reason === 'unknown_price' && ' · 保護者が価格を確かめてから OK'}
                {preview.decision.status === 'pending' && preview.decision.reason === 'off' && ' · 保護者の承認が必要'}
              </p>
            )}
          </div>
        </div>

        <div className="swatches">
          {colors.map((x, i) => (
            <div key={x.color.id} className={`swatch-wrap ${!priceless && x.price == null ? 'soldout' : ''}`}>
              <ColorSwatch color={x.color} selected={i === idx} onClick={() => setIdx(i)} />
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
