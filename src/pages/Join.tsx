import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { normalizeFamilyCode } from '../lib/ids'
import { resubscribeParentPush } from '../lib/push'
import { getStore } from '../store'
import { joinFamily } from '../store/family'
import { useSettings } from '../store/settings'
import type { FamilyInfo } from '../store/types'

/** QR やリンク（#/join/コード）で開いたとき: この端末を親の端末としてその家族につなぐ。PIN は要らない */
export function Join() {
  const { code = '' } = useParams()
  const c = normalizeFamilyCode(code)
  const nav = useNavigate()
  const settings = useSettings()
  const [fam, setFam] = useState<FamilyInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formatErr = c.length === 6 ? null : 'コードの形式が違います'

  useEffect(() => {
    if (c.length !== 6) return
    let alive = true
    getStore()
      .getFamily(c)
      .then((f) => {
        if (!alive) return
        if (f) setFam(f)
        else setErr('そのコードの家族は見つかりません')
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [c])

  async function join() {
    setBusy(true)
    setErr(null)
    try {
      await joinFamily(c)
      // 通知を許可済みの端末なら、購読をこの家族に付け替える
      await resubscribeParentPush(c).catch(() => undefined)
      nav('/parent', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const already = settings.familyId === c && settings.parentDevice
  return (
    <main className="page center">
      <span className="eyebrow">Brick Wish</span>
      <h1>この端末を親スマホにする</h1>
      {(formatErr ?? err) && <p className="error">{formatErr ?? err}</p>}
      {!formatErr && !err && !fam && <Loading />}
      {fam && (
        <>
          <p>
            ファミリー <code>{c}</code> につなぐと、子どものおねがいがこの端末に届き、承認と支払いができます。
          </p>
          {already ? (
            <Link className="btn btn-big" to="/parent">
              親画面を開く
            </Link>
          ) : (
            <button className="btn btn-big" onClick={() => void join()} disabled={busy}>
              つなぐ
            </button>
          )}
        </>
      )}
      <Link className="btn btn-ghost" to="/kid">
        やめる
      </Link>
    </main>
  )
}
