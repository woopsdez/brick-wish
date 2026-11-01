import { Link } from 'react-router-dom'
import { yen } from '../lib/budget'
import { useCartSummary } from '../store/cart'
import { Icon } from './Icon'

/** 子ども画面のヘッダーに置くカートボタン。個数と、いま入っている分の合計を出す */
export function CartButton() {
  const { count, total, known } = useCartSummary()
  const amount = total != null ? yen(total) : `${yen(known)}〜`
  return (
    <Link className="btn btn-cart" to="/kid/cart" aria-label={`カートを見る、${count} 個${count > 0 ? `、合計 ${amount}` : ''}`}>
      <Icon name="cart" />
      <span className="count">{count}</span>
      {count > 0 && <span className="cart-amount">{amount}</span>}
    </Link>
  )
}
