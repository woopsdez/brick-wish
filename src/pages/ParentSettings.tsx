import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { catalog } from '../catalog'
import { yen } from '../lib/budget'
import { hasPush, hasSupabase } from '../lib/config'
import { normalizeFamilyCode, sha256Hex } from '../lib/ids'
import { getPushState, subscribeParentPush, type PushState } from '../lib/push'
import { SHOP, shopMap } from '../lib/shop'
import { getStore } from '../store'
import { useFamily } from '../store/family-hooks'
import { saveSettings, setParentUnlocked, useSettings } from '../store/settings'

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

export function ParentSettings() {
  const settings = useSettings()
  const { family, reload } = useFamily(settings.familyId)
  const [push, setPush] = useState<PushState>('disabled')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinPin, setJoinPin] = useState('')
  const [joinErr, setJoinErr] = useState<string | null>(null)

  async function saveBudget(n: number, auto: boolean) {
    if (!settings.familyId) return
    await getStore().setFamilyBudget(settings.familyId, n, auto)
    reload()
    setMsg(`自動承認枠を ${yen(n)} / 月${auto ? '' : '（オフ）'} にしました`)
  }

  async function joinFamily() {
    setJoinErr(null)
    const c = normalizeFamilyCode(joinCode)
    if (c.length !== 6) return setJoinErr('コードは 6 文字です')
    const fam = await getStore().getFamily(c)
    if (!fam) return setJoinErr('そのコードは見つかりません')
    const h = await sha256Hex(joinPin)
    if (fam.pin_hash && fam.pin_hash !== h) return setJoinErr('PIN が違います')
    saveSettings({ familyId: c, localPinHash: fam.pin_hash ?? null })
    setParentUnlocked(true)
    setMsg(`ファミリー ${c} につなぎました`)
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

  const shopCount = Object.values(shopMap.items).filter((i) => i.available).length

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
        <h2>自動承認（月の枠）</h2>
        <p className="muted">
          枠内のリクエストは承認なしで「支払い待ち」になり、通知が来ます。枠は送料を含みません。月が変わるとリセットされます。
        </p>
        {family && <BudgetForm key={`${family.monthly_budget_yen}|${family.auto_approve}`} initialBudget={family.monthly_budget_yen} initialAuto={family.auto_approve} onSave={saveBudget} />}
        {msg && <p className="ok">{msg}</p>}
      </section>

      <dl className="kv">
        <dt>モード</dt>
        <dd>{hasSupabase ? 'オンライン（Supabase）' : 'ローカル'}</dd>
        <dt>ファミリーコード</dt>
        <dd>
          <code>{settings.familyId}</code>
        </dd>
        <dt>通知</dt>
        <dd>
          {!hasPush && '未設定（VITE_VAPID_PUBLIC_KEY が無い）'}
          {hasPush && push === 'subscribed' && 'このスマホに届きます'}
          {hasPush && push !== 'subscribed' && (
            <button className="btn" onClick={() => settings.familyId && void subscribeParentPush(settings.familyId).then(setPush)}>
              <Icon name="bell" size={18} />
              通知を許可する
            </button>
          )}
        </dd>
        <dt>カタログ</dt>
        <dd>
          {catalog.parts.length} パーツ / {catalog.colors.length} 色
          <br />
          <span className="muted">{catalog.source}</span>
        </dd>
        <dt>価格・在庫</dt>
        <dd>
          {SHOP.name}：{shopCount} 品が在庫あり（{new Date(SHOP.fetchedAt).toLocaleDateString('ja-JP')} 取得）
          {SHOP.sample && (
            <>
              <br />
              <em className="warn">サンプルデータです。本物は `node scripts/build-shop-map.mjs` で取得してください</em>
            </>
          )}
        </dd>
      </dl>

      <section className="stack">
        <h2>PIN を変える</h2>
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="新しい PIN（4 桁以上）" />
        <button className="btn" onClick={() => void changePin()} disabled={pin.length < 4}>
          変更
        </button>
      </section>

      {hasSupabase && (
        <section className="stack">
          <h2>別の端末とつなぐ</h2>
          <p className="muted">子どものタブレットの親画面に出ているファミリーコードと、そこで決めた PIN を入れると、このスマホで承認できるようになります。</p>
          <input value={joinCode} onChange={(e) => setJoinCode(normalizeFamilyCode(e.target.value))} placeholder="ファミリーコード（6 文字）" autoCapitalize="characters" />
          <input type="password" inputMode="numeric" value={joinPin} onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN" />
          {joinErr && <p className="error">{joinErr}</p>}
          <button className="btn" onClick={() => void joinFamily()} disabled={joinCode.length !== 6}>
            つなぐ
          </button>
        </section>
      )}

      <section className="stack">
        <h2>この端末</h2>
        <button className="btn btn-ghost" onClick={() => { setParentUnlocked(false); location.hash = '#/kid' }}>
          <Icon name="lock" size={18} />
          ロックして子ども画面へ
        </button>
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
          初期化
        </button>
      </section>
    </main>
  )
}
