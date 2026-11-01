import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { catalog } from '../catalog'
import { Icon } from '../components/Icon'
import { Loading } from '../components/Loading'
import { PartImage } from '../components/PartImage'
import { QtyStepper } from '../components/QtyStepper'
import { StatusBadge } from '../components/StatusBadge'
import { bricklinkCatalogUrl, buildPickABrickCsv, buildWantedListXml, downloadText, mergeItems } from '../lib/bricklink'
import { estimateTotal, spentThisMonth, yen } from '../lib/budget'
import { BRICKLINK_WANTED_LIST_URL, BRICKLINK_WANTED_UPLOAD_URL } from '../lib/config'
import { SHOP, cartPermalink, orderListText, priceStatus, productUrl, shippingFor } from '../lib/shop'
import { getStore } from '../store'
import { useFamily } from '../store/family-hooks'
import { useFamilyId } from '../store/family'
import { useRequests } from '../store/useRequests'
import type { CartItem, WishRequest } from '../types'

export function ParentRequest() {
  const { id } = useParams()
  const familyId = useFamilyId()
  const { requests, loading } = useRequests(familyId)
  const req = requests.find((r) => r.id === id)

  if (loading && !req) return <main className="page parent"><Loading /></main>
  if (!req) return <main className="page parent">見つかりません。<Link to="/parent">一覧へ</Link></main>
  return <Detail key={req.id + req.updated_at} req={req} requests={requests} />
}

const categoryDesc = new Map(catalog.categories.map((c) => [c.id, `${c.name_ja}：${c.description ?? ''}`]))

function Detail({ req, requests }: { req: WishRequest; requests: WishRequest[] }) {
  const nav = useNavigate()
  const familyId = useFamilyId()
  const { family } = useFamily(familyId)
  const [items, setItems] = useState<CartItem[]>(() => mergeItems(req.items))
  const [parentNote, setParentNote] = useState(req.parent_note)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const totalQty = items.reduce((n, i) => n + i.qty, 0)
  const { total, unknown } = useMemo(() => estimateTotal(items), [items])
  const editable = req.status === 'pending'
  const remaining = family ? Math.max(0, family.monthly_budget_yen - spentThisMonth(requests)) : null

  async function decide(status: 'approved' | 'rejected') {
    setBusy(true)
    setErr(null)
    try {
      await getStore().update(req.family_id, req.id, { status, items, parent_note: parentNote.trim(), approved_by: status === 'approved' ? 'parent' : null, total_yen: total })
      if (status === 'rejected') nav('/parent')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function markOrdered() {
    setBusy(true)
    try {
      await getStore().update(req.family_id, req.id, { status: 'ordered' })
      nav('/parent')
    } finally {
      setBusy(false)
    }
  }

  function setQty(it: CartItem, qty: number) {
    setItems((cur) => (qty <= 0 ? cur.filter((x) => x !== it) : cur.map((x) => (x === it ? { ...x, qty } : x))))
  }

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <main className="page parent">
      <header className="parent-header">
        <Link className="btn btn-ghost back" to="/parent">
          <Icon name="back" size={18} />
          一覧
        </Link>
        <StatusBadge status={req.status} parent auto={req.approved_by === 'auto'} />
      </header>

      <h1>
        <span className="num">{total != null ? yen(total) : '価格不明あり'}</span>{' '}
        <span className="muted small">送料別 · {new Date(req.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </h1>
      {req.note && (
        <p className="note">
          「<Linkified text={req.note} />」
        </p>
      )}
      {req.status === 'approved' && req.approved_by === 'auto' && (
        <p className="callout ok-callout">今月の枠内なので自動で承認されています。あとは下の手順で支払うだけです。</p>
      )}
      {editable && (
        <p className="callout">
          {unknown.length > 0
            ? unknown.some((u) => priceStatus(u.part_num, u.color_id) !== 'soldout')
              ? `${unknown.length} 件は価格が未確認のため自動承認できませんでした。商品ページで価格と在庫を見て、数量を決めてください。`
              : `${unknown.length} 件は${SHOP.name}に在庫がないため自動承認できませんでした。数量を 0 にして外すか、BrickLink で買うか決めてください。`
            : remaining != null
              ? `今月の自動承認枠の残り ${yen(remaining)} を超えるため、承認が必要です。`
              : '承認が必要です。'}
        </p>
      )}

      {editable && <ParentHowto />}

      <ul className="cart-list">
        {items.map((i) => (
          <li key={`${i.part_num}|${i.color_id}`} className="cart-row">
            <PartImage partNum={i.part_num} colorId={i.color_id} elementId={i.element_id} rgb={i.color_rgb} category={i.category} alt={i.part_name_ja} />
            <div className="cart-info">
              <strong>
                {i.part_name_ja} <span className="muted small">{i.part_num}</span>
              </strong>
              <span className="muted">
                <span className="dot" style={{ background: `#${i.color_rgb}` }} /> {i.color_name} ·{' '}
                {i.unit_yen != null ? `${yen(i.unit_yen)} × ${i.qty} = ${yen(i.unit_yen * i.qty)}` : priceStatus(i.part_num, i.color_id) === 'soldout' ? <em className="warn">{SHOP.name}に在庫なし</em> : <em className="warn">価格未確認 · 商品ページで見る</em>}
              </span>
              {i.category && categoryDesc.has(i.category) && i.category !== 'basic' && <span className="muted small">{categoryDesc.get(i.category)}</span>}
              <span className="row small">
                {i.shop_key && (
                  <a className="ext" href={productUrl(i.shop_key)} target="_blank" rel="noopener noreferrer">
                    {SHOP.name}の商品ページ <Icon name="external" size={14} />
                  </a>
                )}
                <a className="ext muted" href={bricklinkCatalogUrl(i.bl_id, i.bl_color_id)} target="_blank" rel="noopener noreferrer">
                  BrickLink <Icon name="external" size={14} />
                </a>
              </span>
            </div>
            {editable ? <QtyStepper value={i.qty} onChange={(n) => setQty(i, n)} min={0} /> : <span className="qty-static">× {i.qty}</span>}
          </li>
        ))}
      </ul>
      {total != null ? (
        <dl className="totals">
          <dt className="label">
            小計 · {items.length} 種類 / {totalQty} 個
          </dt>
          <dd className="val">{yen(total)}</dd>
          <dt className="label">
            送料
            {shippingFor(total) === 0 ? `（${yen(SHOP.freeShippingFromYen)} 以上で無料）` : total < SHOP.smallOrderBelowYen ? `（${yen(SHOP.shippingYen)} + 少額手数料 ${yen(SHOP.smallOrderFeeYen)}）` : ''}
          </dt>
          <dd className="val">{yen(shippingFor(total))}</dd>
          <dt className="label total">合計</dt>
          <dd className="val total">{yen(total + shippingFor(total))}</dd>
        </dl>
      ) : (
        <p className="muted">
          {items.length} 種類 / {totalQty} 個 · 価格不明あり
        </p>
      )}

      {editable && (
        <section className="decide">
          <label>
            子どもへのメッセージ（任意）
            <input value={parentNote} onChange={(e) => setParentNote(e.target.value)} placeholder="例: 赤いのは今あるやつ使おう" />
          </label>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn btn-big" disabled={busy || items.length === 0} onClick={() => void decide('approved')}>
              <Icon name="check" size={18} />
              承認して支払いへ
            </button>
            <button className="btn btn-big btn-danger" disabled={busy} onClick={() => void decide('rejected')}>
              今回は見送り
            </button>
          </div>
          <p className="muted small">承認しても請求はされません。次の画面で{SHOP.name}のカートに入れて、そこで支払います。</p>
        </section>
      )}

      {(req.status === 'approved' || req.status === 'ordered') && <OrderSection items={items} req={req} busy={busy} onOrdered={() => void markOrdered()} copied={copied} copy={copy} />}
    </main>
  )
}

function OrderSection({ items, req, busy, onOrdered, copied, copy }: { items: CartItem[]; req: WishRequest; busy: boolean; onOrdered: () => void; copied: string | null; copy: (label: string, text: string) => Promise<void> }) {
  const { url: permalink, missing } = cartPermalink(items)
  const inShop = items.filter((i) => !missing.includes(i))
  // 価格未確認（「ぜんぶ」タブ）の行は商品ページから手で入れる。ショップに無いと分かっている行だけ BrickLink へ
  const unchecked = missing.filter((i) => priceStatus(i.part_num, i.color_id) !== 'soldout')
  const absent = missing.filter((i) => !unchecked.includes(i))
  const xml = buildWantedListXml(absent.length ? absent : items, { condition: null })
  const { total } = estimateTotal(inShop)
  const live = permalink != null && !SHOP.sample
  return (
    <section className="order">
      <h2>{SHOP.name}で支払う</h2>
      <p className="muted">
        国内の専門店 1 店にまとめて注文します（決済 1 回、日本語、送料 {yen(SHOP.shippingYen)}、{yen(SHOP.freeShippingFromYen)} 以上で無料、{yen(SHOP.smallOrderBelowYen)} 未満は +{yen(SHOP.smallOrderFeeYen)}、PayPay・クレカ・後払い可）。
      </p>
      <ol className="steps">
        <li>
          {live ? (
            <a className="btn btn-big" href={permalink} target="_blank" rel="noopener noreferrer">
              <Icon name="cart" size={18} />
              カートに全部入れる
            </a>
          ) : (
            <>
              <button className="btn btn-big" disabled title={SHOP.sample ? '本物の価格データ（npm run shop-map）を取り込むと有効になります' : unchecked.length ? '価格未確認の行があります' : `${SHOP.name}に無い行があります`}>
                <Icon name="cart" size={18} />
              カートに全部入れる
              </button>
              <span className="muted small">
                {SHOP.sample ? '価格がサンプルの間は無効です。本物のデータを取り込むと、このボタン 1 つでカートが埋まった状態の支払い画面が開きます。' : unchecked.length ? '価格未確認の行があります。下の商品ページから手で入れてください。' : `${SHOP.name}に無い行を外すか、下の BrickLink に回してください。`}
              </span>
            </>
          )}
        </li>
        <li>
          <span>
            {SHOP.name}でそのまま支払い{total != null && `（小計 ${yen(total)} + 送料 ${yen(shippingFor(total))}）`}
          </span>
        </li>
        <li>
          {req.status === 'approved' ? (
            <button className="btn" disabled={busy} onClick={onOrdered}>
              <Icon name="box" size={18} />
              支払ったので「注文済み」にする
            </button>
          ) : (
            <span className="muted">注文済み</span>
          )}
        </li>
      </ol>
      {unchecked.length > 0 && (
        <details className="fallback" open>
          <summary>価格未確認の {unchecked.length} 件は商品ページから入れる</summary>
          <ul className="muted small">
            {unchecked.map((i) => (
              <li key={`${i.part_num}|${i.color_id}`}>
                {i.part_name_ja} {i.color_name} × {i.qty}
                {i.shop_key && (
                  <>
                    {' · '}
                    <a className="ext" href={productUrl(i.shop_key)} target="_blank" rel="noopener noreferrer">
                      商品ページ <Icon name="external" size={14} />
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small">{SHOP.name}に無ければ、下の BrickLink に回してください。</p>
        </details>
      )}
      {!live && inShop.length > 0 && (
        <details className="fallback">
          <summary>手動で入れる場合（注文リストをコピー）</summary>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => void copy('list', orderListText(inShop))}>
              {copied === 'list' ? 'コピーした' : `注文リストをコピー（${inShop.length} 行）`}
            </button>
            <a className="btn btn-ghost" href={SHOP.listOrderUrl} target="_blank" rel="noopener noreferrer">
              {SHOP.name}の「ファイル・リストで注文」 <Icon name="external" size={14} />
            </a>
          </div>
          <p className="muted small">品番-色ID と数量の行を貼り付けると一括でカートに入ります（受け付け形式はショップ側で確認）</p>
        </details>
      )}

      {absent.length > 0 && (
        <details className="fallback" open>
          <summary>
            {SHOP.name}に無い {absent.length} 件を BrickLink（海外）で買う
          </summary>
          <p className="muted small">BrickLink は世界中の個人店が出品するサイトで、店ごとに決済と送料がかかり、英語で、海外発送に 2〜3 週間かかります。急がなければ次回に回すのも手です。</p>
          <ul className="muted small">
            {absent.map((i) => (
              <li key={`${i.part_num}|${i.color_id}`}>
                {i.part_name_ja} {i.color_name} × {i.qty}
              </li>
            ))}
          </ul>
          <BrickLinkSteps xml={xml} reqId={req.id} copied={copied} copy={copy} />
        </details>
      )}
      {absent.length === 0 && (
        <details className="fallback">
          <summary>BrickLink（海外）で買う場合</summary>
          <BrickLinkSteps xml={buildWantedListXml(items, { condition: null })} reqId={req.id} copied={copied} copy={copy} />
          <details>
            <summary>LEGO Pick a Brick 用 CSV（日本ではオンライン未提供）</summary>
            <PabExport items={items} id={req.id} />
          </details>
        </details>
      )}
    </section>
  )
}

function BrickLinkSteps({ xml, reqId, copied, copy }: { xml: string; reqId: string; copied: string | null; copy: (label: string, text: string) => Promise<void> }) {
  return (
    <ol className="steps">
      <li>
        <button className="btn btn-ghost" onClick={() => downloadText(`brick-wish-${reqId.slice(0, 8)}.xml`, xml, 'application/xml')}>
          <Icon name="download" size={18} />
          Wanted List XML
        </button>
        <button className="btn btn-ghost" onClick={() => void copy('xml', xml)}>
          {copied === 'xml' ? 'コピーした' : 'XML をコピー'}
        </button>
      </li>
      <li>
        <a className="btn btn-ghost" href={BRICKLINK_WANTED_UPLOAD_URL} target="_blank" rel="noopener noreferrer">
          BrickLink のアップロード画面 <Icon name="external" size={14} />
        </a>
        <span className="muted small">ログイン →「Upload」タブに XML を貼り付け → Wanted List として保存</span>
      </li>
      <li>
        <a className="btn btn-ghost" href={BRICKLINK_WANTED_LIST_URL} target="_blank" rel="noopener noreferrer">
          Wanted List 一覧 <Icon name="external" size={14} />
        </a>
        <span className="muted small">「Buy All」→ Auto-select で店を自動選択 → 店ごとに支払い</span>
      </li>
    </ol>
  )
}

/** レゴのパーツ売買を知らない親向けの説明。承認前だけ出す */
function ParentHowto() {
  return (
    <details className="howto">
      <summary>はじめての方へ：この画面でやること</summary>
      <ol>
        <li>下の一覧が、子どもが欲しいと言っているレゴのパーツです。1 行が 1 種類で、単価 × 個数が出ています。</li>
        <li>各行の「{SHOP.name}の商品ページ」で写真と在庫を確認できます。</li>
        <li>多いと思ったら個数を減らせます。0 にするとその行は外れます。</li>
        <li>「承認して支払いへ」を押すと、{SHOP.name}のカートに入れて支払う手順が出ます。請求は{SHOP.name}で支払ったときだけです。</li>
      </ol>
      <p>
        <strong>{SHOP.name}とは</strong>：レゴのパーツを 1 個から売っている国内の専門店です。レゴ公式ショップは日本ではパーツの単品販売をしていないので、こうした店で買います。
      </p>
    </details>
  )
}

/** メモ内の URL をリンクにする */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s「」"]+)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function PabExport({ items, id }: { items: CartItem[]; id: string }) {
  const { csv, skipped } = buildPickABrickCsv(items)
  const ok = items.length - skipped.length
  return (
    <div className="stack">
      <p className="muted">
        出力可能 {ok} 件 / 除外 {skipped.length} 件（element ID 未登録）。Pick a Brick のリストアップロードは米国・カナダ・英国・ドイツのみ。
      </p>
      <button className="btn btn-ghost" disabled={ok === 0} onClick={() => downloadText(`pick-a-brick-${id.slice(0, 8)}.csv`, csv, 'text/csv')}>
        <Icon name="download" size={18} />
        CSV をダウンロード
      </button>
    </div>
  )
}
