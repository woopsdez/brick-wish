import { useEffect, useState } from 'react'
import type { CartItem } from '../types'

const KEY = 'bw:cart:v1'
const listeners = new Set<() => void>()

export function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartItem[]
  } catch {
    return []
  }
}

function save(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  listeners.forEach((l) => l())
}

export const cartKey = (i: Pick<CartItem, 'part_num' | 'color_id'>) => `${i.part_num}|${i.color_id}`

export function addToCart(item: CartItem) {
  const items = loadCart()
  const cur = items.find((i) => cartKey(i) === cartKey(item))
  if (cur) cur.qty = Math.min(999, cur.qty + item.qty)
  else items.push(item)
  save(items)
}

export function setCartQty(item: Pick<CartItem, 'part_num' | 'color_id'>, qty: number) {
  const items = loadCart()
  const i = items.findIndex((x) => cartKey(x) === cartKey(item))
  if (i < 0) return
  if (qty <= 0) items.splice(i, 1)
  else items[i].qty = Math.min(999, qty)
  save(items)
}

export function clearCart() {
  save([])
}

export function useCart(): CartItem[] {
  const [items, setItems] = useState(loadCart)
  useEffect(() => {
    const l = () => setItems(loadCart())
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  return items
}
