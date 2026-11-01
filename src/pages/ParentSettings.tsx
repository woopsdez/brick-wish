import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasPush, hasSupabase } from '../lib/config'
import { sha256Hex } from '../lib/ids'
import { getPushState, subscribeParentPush, type PushState } from '../lib/push'
import { getStore } from '../store'
import { saveSettings, useSettings } from '../store/settings'
import { catalog } from '../catalog'

export function ParentSettings() {
  const settings = useSettings()
  const [push, setPush] = useState<PushState>('disabled')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

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
        <Link className="btn btn-ghost" to="/parent">
          ← 一覧
        </Link>
        <h1>設定</h1>
      </header>

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
              🔔 通知を許可する
            </button>
          )}
        </dd>
        <dt>カタログ</dt>
        <dd>
          {catalog.parts.length} パーツ / {catalog.colors.length} 色
          <br />
          <span className="muted">{catalog.source}</span>
        </dd>
      </dl>

      <section className="stack">
        <h2>PIN を変える</h2>
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="新しい PIN（4 桁以上）" />
        <button className="btn" onClick={() => void changePin()} disabled={pin.length < 4}>
          変更
        </button>
        {msg && <p className="ok">{msg}</p>}
      </section>

      <section className="stack">
        <h2>この端末の役割を変える</h2>
        <p className="muted">子ども用タブレットに切り替えるときはこちら。もう一度親にするにはファミリーコードと PIN が必要です。</p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm('この端末を「こども」モードにしますか？')) saveSettings({ role: 'kid' })
          }}
        >
          こどもモードにする
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('この端末の設定をすべて消しますか？（おねがいの履歴はローカルモードの場合のみ消えます）')) {
              localStorage.clear()
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
