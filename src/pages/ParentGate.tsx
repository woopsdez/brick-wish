import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { sha256Hex } from '../lib/ids'
import { getStore } from '../store'
import { useFamilyId } from '../store/family'
import { saveSettings, setParentUnlocked, useSettings } from '../store/settings'

type State = 'loading' | 'set-pin' | 'enter-pin' | 'open'

/**
 * 親画面のゲート。
 *  - PIN 未設定 → ここで決める（初回だけ）
 *  - PIN 設定済み → 入力。正解ならこのタブの間は解除されたまま
 */
export function ParentGate() {
  const familyId = useFamilyId()
  const settings = useSettings()
  const nav = useNavigate()
  const [state, setState] = useState<State>('loading')
  const [pinHash, setPinHash] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!familyId) return
    if (settings.parentUnlocked) {
      setState('open')
      return
    }
    void getStore()
      .getFamily(familyId)
      .then((fam) => {
        const h = fam?.pin_hash ?? settings.localPinHash
        setPinHash(h)
        setState(h ? 'enter-pin' : 'set-pin')
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [familyId, settings.parentUnlocked, settings.localPinHash])

  async function submitSet() {
    if (!familyId) return
    if (pin.length < 4) return setErr('4 桁以上にしてください')
    if (pin !== pin2) return setErr('2 回の入力が違います')
    const h = await sha256Hex(pin)
    await getStore().setFamilyPin(familyId, h)
    saveSettings({ localPinHash: h })
    setParentUnlocked(true)
    setState('open')
  }

  async function submitEnter() {
    const h = await sha256Hex(pin)
    if (h !== pinHash) return setErr('PIN が違います')
    setParentUnlocked(true)
    setState('open')
  }

  if (state === 'open') return <Outlet />
  if (state === 'loading') return <main className="page center">{err ? <p className="error">{err}</p> : '…'}</main>

  const isSet = state === 'set-pin'
  return (
    <main className="page center">
      <h1>保護者の画面</h1>
      <p className="muted">{isSet ? '最初に、承認用の PIN（4 桁以上の数字）を決めてください' : 'PIN を入れてください'}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          setErr(null)
          void (isSet ? submitSet() : submitEnter())
        }}
      >
        <input type="password" inputMode="numeric" className="code-input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus />
        {isSet && (
          <input type="password" inputMode="numeric" className="code-input" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} placeholder="もう一度" />
        )}
        {err && <p className="error">{err}</p>}
        <button className="btn btn-big">{isSet ? '決める' : '開く'}</button>
        <Link className="btn btn-ghost" to="/kid" onClick={() => nav('/kid')}>
          戻る
        </Link>
      </form>
    </main>
  )
}
