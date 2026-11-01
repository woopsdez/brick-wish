import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { familyCode, normalizeFamilyCode, sha256Hex } from '../lib/ids'
import { hasSupabase } from '../lib/config'
import { getStore } from '../store'
import { saveSettings, useSettings } from '../store/settings'

type Step = 'role' | 'parent-new' | 'kid-join'

export function Setup() {
  const nav = useNavigate()
  const settings = useSettings()
  const [step, setStep] = useState<Step>('role')
  const [code, setCode] = useState(settings.familyId ?? '')
  const [pin, setPin] = useState('')
  const [kidName, setKidName] = useState(settings.kidName)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function startParent() {
    setBusy(true)
    setErr(null)
    try {
      const c = code ? normalizeFamilyCode(code) : familyCode()
      if (pin.length < 4) throw new Error('PIN は 4 桁以上にしてください')
      const hash = await sha256Hex(pin)
      const fam = await getStore().ensureFamily(c, hash)
      if (fam.pin_hash && fam.pin_hash !== hash) throw new Error('このファミリーコードは既に別の PIN で使われています')
      if (!fam.pin_hash) await getStore().setFamilyPin(c, hash)
      saveSettings({ role: 'parent', familyId: c, localPinHash: hash })
      nav('/parent', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function joinKid() {
    setBusy(true)
    setErr(null)
    try {
      const c = normalizeFamilyCode(code)
      if (c.length !== 6) throw new Error('コードは 6 文字です')
      const fam = await getStore().getFamily(c)
      if (!fam) throw new Error('そのコードは見つかりません。おうちの人の画面のコードを確認してください')
      saveSettings({ role: 'kid', familyId: c, kidName: kidName.trim() || 'こども' })
      nav('/kid', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page setup">
      <h1 className="logo">🧱 Brick Wish</h1>
      <p className="muted">
        {hasSupabase ? 'オンラインモード：親スマホと子タブレットを同期します' : 'ローカルモード：この端末の中だけで動きます'}
      </p>

      {step === 'role' && (
        <div className="stack">
          <button className="btn btn-big" onClick={() => setStep('parent-new')}>
            👩‍👧 おうちの人（親）としてはじめる
          </button>
          <button className="btn btn-big btn-kid" onClick={() => setStep('kid-join')}>
            🧒 こどもとしてはじめる
          </button>
          {!hasSupabase && (
            <p className="hint">
              ローカルモードでは、まず「親」でファミリーコードと PIN を作り、その後同じ端末で「こども」として同じコードを入れます。
            </p>
          )}
        </div>
      )}

      {step === 'parent-new' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void startParent()
          }}
        >
          <label>
            ファミリーコード（空欄なら自動生成）
            <input value={code} onChange={(e) => setCode(normalizeFamilyCode(e.target.value))} placeholder="例: K7M2PQ" autoCapitalize="characters" />
          </label>
          <label>
            承認用 PIN（4 桁以上の数字）
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" type="password" placeholder="••••" />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-big" disabled={busy}>
            はじめる
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep('role')}>
            もどる
          </button>
        </form>
      )}

      {step === 'kid-join' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void joinKid()
          }}
        >
          <label>
            おうちのコード（6もじ）
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(normalizeFamilyCode(e.target.value))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          <label>
            なまえ
            <input value={kidName} onChange={(e) => setKidName(e.target.value)} placeholder="例: はると" />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-big btn-kid" disabled={busy}>
            はじめる
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep('role')}>
            もどる
          </button>
        </form>
      )}
    </main>
  )
}
