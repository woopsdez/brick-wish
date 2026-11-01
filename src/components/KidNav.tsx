import { NavLink } from 'react-router-dom'
import { useCart } from '../store/cart'
import { Icon } from './Icon'

/** 子ども画面の下タブ: パーツ / カート / 履歴 / ぜんぶ */
export function KidNav() {
  const cart = useCart()
  const count = cart.reduce((n, i) => n + i.qty, 0)
  return (
    <nav className="kid-nav" aria-label="メイン">
      <div className="kid-nav-inner">
        <NavLink to="/kid" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="grid" size={22} />
          パーツ
        </NavLink>
        <NavLink to="/kid/cart" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="cart" size={22} />
          カート
          {count > 0 && <span className="count">{count}</span>}
        </NavLink>
        <NavLink to="/kid/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="clock" size={22} />
          履歴
        </NavLink>
        <NavLink to="/kid/all" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="search" size={22} />
          ぜんぶ
        </NavLink>
      </div>
    </nav>
  )
}
