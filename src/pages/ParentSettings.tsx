import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { yen } from '../lib/budget'
import { hasPush } from '../lib/config'
import { sha256Hex } from '../lib/ids'
import { getPushState, type PushState } from '../lib/push'
import { getStore } from '../store'
import { useFamily } from '../store/family-hooks'
import { saveSettings, useSettings } from '../store/settings'

function BudgetForm({ initialBudget, initialAuto, onSave }: { initialBudget: number; initialAuto: boolean; onSave: (n: number, auto: boolean) => Promise<void> }) {
  const [budget, setBudget] = useState(String(initialBudget))
  const [auto, setAuto] = useState(initialAuto)
  return (
    <>
      <label>
        1 か月の枠（円）
        <input type="number" inputMode="numeric" min={0} step={100} value={budget} onChange={(e) => setBudget(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 枠内は自動で承認する
      </label>
      <button className="btn" onClick={() => void onSave(Math.max(0, parseInt(budget, 10) || 0), auto)}>
        保存
      </button>
    </>
  )
}

/** 設定。ユーザーが手を打てるものだけ置く（見ても何もできない情報は出さない） */
export function ParentSettings() {
  const settings = useSettings()
  const { family, reload } = useFamily(settings.familyId)
  const [push, setPush] = useState<PushState>('disabled')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function saveBudget(n: number, auto: boolean) {
    if (!settings.familyId) return
    await getStore().setFamilyBudget(settings.familyId, n, auto)
    reload()
    setMsg(`自動承認枠を ${yen(n)} / 月${auto ? '' : '（オフ）'} にしました`)
  }

  useEffect(() => {
    void getPushState().then(setPush)
  }, [])

  async function changePin() {
    if (!settings.familyId || pin.length < 4) return
    const hash = await sha256Hex(pin)
    await getStore().setFamilyPin(settings.familyId, hash)
    saveSettings({ localPinHash: hash })
    setPin('')
    setMsg('PIN を変更しました')
  }

  return (
    <main className="page parent">
      <header className="parent-header">
        <Link className="btn btn-ghost back" to="/parent">
          <Icon name="back" size={18} />
          一覧
        </Link>
        <h1>設定</h1>
      </header>

      <section className="stack">
        <h2>月の枠</h2>
        {family && <BudgetForm key={`${family.monthly_budget_yen}|${family.auto_approve}`} initialBudget={family.monthly_budget_yen} initialAuto={family.auto_approve} onSave={saveBudget} />}
      </section>

      {hasPush && push === 'denied' && (
        <section className="stack">
          <h2>通知</h2>
          <p className="muted">ブロックされています。ブラウザ（ホーム画面に追加したアプリ）の設定で許可すると届きます。</p>
        </section>
      )}

      <section className="stack">
        <h2>PIN</h2>
        <label>
          新しい PIN（4 桁以上）
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button className="btn btn-ghost" onClick={() => void changePin()} disabled={pin.length < 4}>
          変更
        </button>
      </section>

      {msg && <p className="ok">{msg}</p>}

      <section className="stack" style={{ marginTop: 32 }}>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm('この端末の設定をすべて消しますか？（リクエスト履歴はローカルモードの場合のみ消えます）')) {
              localStorage.clear()
              sessionStorage.clear()
              location.hash = '#/'
              location.reload()
            }
          }}
        >
          この端末を初期化
        </button>
      </section>
    </main>
  )
}
