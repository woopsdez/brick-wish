# Brick Wish 🧱

レゴでミニメカを作る中高生が、公式ショップに無い関節や 1×1 などの小さいパーツをカタログからタップして選び、レゴに詳しくない親が承認・支払いだけで済むようにする家庭用アプリ。人がやるのは **パーツ選び（子）・承認（親、月の枠を超えたときだけ）・支払い（親）** の 3 つに絞る。

- **ビルダー（子ども）画面**: ミニメカ向け厳選カタログ（205 種）をカテゴリで眺めて、タップ → 色と数量 → カート。色ごとに国内ショップの単価と在庫を表示。カートで小計と「今月の自動承認枠の残り」を見せる。
- **自動承認**: 月の枠（既定 1,000 円、送料別）以内なら、親の承認なしで「支払い待ち」になる。枠超え・在庫なしのときだけ親に承認を求める。
- **親画面**: 支払い待ち／承認待ちの一覧 → 単価つき明細と商品ページリンク → 国内ショップ（ブリッカーズ）1 店にまとめて注文する手順 → 支払い。BrickLink（海外・店ごと決済）は在庫が無いときの逃げ道として折りたたみ。
- **同期**: Supabase を設定すると親スマホと子タブレットが同期し、Web Push で親に通知。未設定なら 1 台の端末内で完結する「ローカルモード」。
- **ホスティング**: 静的サイト（PWA）。GitHub Pages 用のワークフロー同梱。

## 購入先の判断（調査の要点）

- **日本に LEGO 公式のオンライン Pick a Brick は無い**（[stds.jp 2025/12](https://stds.jp/lego-fortnite-ninjago-nunchaku-pick-a-brick/)）。リスト一括アップロードも米国・カナダ・英国・ドイツのみ（[New Elementary](https://www.newelementary.com/2024/11/pick-brick-germany-and-uk-get-upload.html)）。公式ルートは日本では使えない。
- **BrickLink は構造的に面倒**：規約は 18 歳以上（[ToS](https://v2.bricklink.com/en-us/terms-of-service)）、店ごとに決済と送料（1 店 1,500〜2,000 円）、英語、PayPal かカード、海外から 2〜3 週間（[stds.jp](https://stds.jp/purchase-on-bricklink/)、[灘校 LEGO 同好会](https://note.com/nadalegoclub/n/n7a3974e54677)）。「Auto-select」で店を自動選択しても決済は店ごと。第三者アプリが購入を確定する API は無い。
- **国内に 1 店で揃う専門店がある**：[ブリッカーズ](https://brickers.jp/)は 1 万種以上、送料全国 230 円（3,300 円以上無料）、PayPay・クレカ・後払い、11 時までの注文で即日発送（[決済・配送](https://brickers.jp/pages/payment-shipping)）。商品 URL が `/products/{品番}-{LEGO色ID}`（例 `3001-026`＝黒）で機械的に組める。2026/10/26 に「ファイル・リストで注文」β を公開（[告知](https://brickers.jp/?pid=31696531)、受け付け形式は未確認）。[StarBrick37](https://starbrick37.com/) も同じ URL 形式。
- **承認 UX の定石**：Apple「承認と購入のリクエスト」や Amazon Teen は「品目＋金額つき通知 → 承認/却下の 2 択」。カゴ落ちの最大要因は後出しの追加費用とアカウント強制（[Baymard](https://baymard.com/blog/reduce-cart-abandonment)）。

結論：**購入先はブリッカーズ 1 店に固定**し、親の操作を「（枠超えなら承認）→ カートに入れる → 支払い 1 回」まで落とす。「承認＝決済」の完全自動化は、どの店にも購入 API が無いのでできない（やるなら運営が代理購入する事業になる）。

## 価格・在庫データと、取得に必要なこと

価格と在庫は `src/catalog/shop-map.json`（商品キー「品番-LEGO色ID3桁」→ 単価・在庫・Shopify variant id）から引く。**同梱の shop-map.json はサンプル価格**で、画面にもその旨を出す。本物は手元の PC で取得する：

```bash
npm run shop-map            # ブリッカーズの /products/<品番-色ID>.js を 1 秒 1 件で読み、scripts/.cache/shop に保存
npm run shop-map:sample     # ダミー価格で再生成（開発用）
```

取得に関する整理（法律助言ではなく一般的な理解）：価格・在庫は事実データで著作物ではなく、ログイン不要の公開ページを読むこと自体は不正アクセスにあたらない。ただしショップの利用規約で自動取得が禁止されていれば契約上の問題になり得る（ブリッカーズの規約本文はこの開発環境から到達できず未確認）。家庭内 1 件なら低頻度・キャッシュ前提で問題になる可能性は低いが、**他の家庭にも配るなら先方に一言入れる**（御社の在庫・価格を表示して御社のカートに誘導するアプリ、と伝えれば断られにくい）。

shop-map があると親画面に Shopify の[カート permalink](https://help.shopify.com/en/manual/checkout-settings/cart-permalink)（`/cart/variant:数量,…`）で「カートに全部入れる」ボタンが出る。無い／サンプルのときは「品番-色ID<TAB>数量」のリストをコピーして「ファイル・リストで注文」に貼る手順になる。

## カタログの方針（ミニメカ向け）

子どもの用途が「Mechabrick / brickmecha 系のミニトランスフォーマー・ミニメカ」なので、同梱カタログは **関節・クリップ・ヒンジ・横向きポッチ・小さいプレート** を中心にした厳選リスト（`scripts/curated-parts.mjs`、167 パーツ）です。カテゴリは「かんせつ」「クリップ・バー」「ヒンジ」「よこむき」「ちいさいプレート」「タイル・スロープ」「まるいの」「テクニック（ちいさい）」「ロボットのぶひん」「タイヤ」「ふつうのブロック」。

関節は Mixel 系ボールジョイント（14417 ボール横 / 14418 受け端 / 14704 受け横）を主軸にしています。ミニメカ向けには Mixel ジョイントが定番という記述は [htbi-moc のガイド](https://htbi-moc.com/blogs/guides/lego-moc-mechs-from-tiny-walkers-to-giant-titans) や [Eurobricks のスレッド](https://www.eurobricks.com/forum/forums/topic/183461-building-a-mech/) にあります。パーツ番号の意味は [BrickOwl 14418](https://www.brickowl.com/catalog/779982) / [BrickOwl 14704](https://www.brickowl.com/catalog/lego-plate-1-x-2-with-middle-ball-joint-socket-14704/comesin) で確認済み。それ以外の番号・色の有無は未検証で、`npm run catalog` が Rebrickable の CSV で実在確認し、無い番号は警告して除外します。

リストを増減したいときは `scripts/curated-parts.mjs` を編集 → `npm run catalog:starter`（即時・未検証）または `npm run catalog`（要 API キー・検証つき）。

子どもの体験は「カタログを眺めてタップする」に限定しています（作例サイトのリストをコピペする機能は、方向違いとして外しました）。その分、カタログに載っていないと頼めないので、厳選リストの網羅性が肝心です。参考にした作例（brickmecha #403、24 種類）で未収録だった 4 番号（4032a, 15573, 26047, 36840）を含め、ジャンパー・バー付き丸プレート・1×1 ブラケット・ヒンジ筒・ウェッジプレート・小さいテクニックなど 38 種を足して 205 種にしました（番号・色の有無は未検証。`npm run catalog` で確認）。

色には LEGO 社の色 ID（`lego_id`、国内ショップの商品キー用）を持たせています。1（白）・26（黒）・194（薄いグレー）・199（濃いグレー）はブリッカーズの商品 URL で確認済み、残りは記憶ベースで `npm run catalog` が Rebrickable の `external_ids.LEGO` で上書きします。

## 構成

```
src/
  pages/        Kid / PartPicker / KidCart / KidHistory / ParentGate / Parent / ParentRequest / ParentSettings
  store/        settings(端末設定) / family(ファミリー自動作成) / family-hooks(予算設定) / cart / localStore / supabaseStore / useRequests
  lib/          shop(ショップの価格・在庫・カートURL) / budget(月枠と自動承認の判定) / bricklink(XML・CSV生成) / push / images / ids / config
  catalog/      catalog.json（パーツ・色・カテゴリ）/ shop-map.json（ショップの価格・在庫。同梱はサンプル）
  sw.ts         Service Worker（プリキャッシュ + push 通知）
scripts/
  curated-parts.mjs   ミニメカ向け厳選パーツリスト（カテゴリ・色・子ども向け名）
  build-catalog.mjs   厳選リストを Rebrickable のデータで検証し catalog.json を生成（要 API キー）
  starter-catalog.mjs 厳選リストから未検証のまま catalog.json を生成（現在同梱されているもの）
  build-shop-map.mjs  ショップの商品 JSON を読んで shop-map.json を生成（--sample でダミー）
  check-catalog.mjs   catalog / shop-map の整合チェック（npm test）
  make-icons.mjs      favicon.svg から PWA アイコン PNG を生成
supabase/
  migrations/0001_init.sql        テーブル・RLS
  migrations/0002_budget.sql      月予算・自動承認・見積もり合計の列
  functions/notify-parent/        Web Push 送信 Edge Function
.github/workflows/pages.yml       GitHub Pages デプロイ
```

## セットアップ

### 1. ローカルで動かす（5 分）

```bash
npm install
npm run dev
```

ブラウザで開くと、いきなり子ども用の「ほしいパーツ」画面です。カタログからタップして → カートで小計と枠を確認 → 枠内なら「OK にして注文へ進める」（親の承認なし）、枠超えなら「保護者にリクエストを送る」 → 画面下の「保護者の方はこちら」 → 初回だけ PIN を決める → 支払い待ち／承認待ちを開く、の順で一通り試せます。月の枠は親の設定画面で変えられます（既定 1,000 円、送料別）。

### 2. カタログを本物にする（15 分 + ダウンロード時間）

同梱の `src/catalog/catalog.json` は **手書きの暫定版** です。BrickLink の色 ID と「そのパーツにその色が存在するか」は記憶ベースで未検証なので、公開前に必ず差し替えてください。

1. [Rebrickable](https://rebrickable.com/) でアカウントを作り、[API キー](https://rebrickable.com/api/)を取得
2. 実行:
   ```bash
   REBRICKABLE_API_KEY=xxxx npm run catalog
   ```
   - CSV（parts / colors / elements / inventory_parts など）を `scripts/.cache/` にダウンロード。inventory_parts は数十 MB
   - 厳選リストの番号を parts.csv で実在確認し、色は「希望色 ∩ 実際に存在する色」に絞る。無い番号は警告して除外
   - API から BrickLink のパーツ ID と色 ID を取得（レート制限対策で 1 秒待ちを入れている）
   - `--popular 20` を付けると各カテゴリに「収録セット数」上位 20 件を追加
3. 警告に出た番号は Rebrickable で正しい part_num を調べて `scripts/curated-parts.mjs` を直す（例: 4085 は Rebrickable では 4085c など接尾辞付きの可能性）

画像は Rebrickable の CDN（`cdn.rebrickable.com`）を直接参照しています。**ホットリンクの可否は未確認** なので、公開運用前に Rebrickable の利用規約を確認するか、画像を自サイトに同梱する処理を追加してください。

### 3. 親スマホと同期する（Supabase, 30 分）

1. [Supabase](https://supabase.com/) でプロジェクト作成
2. `supabase/migrations/0001_init.sql` を SQL Editor で実行
3. `.env` に設定:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. 子タブレットで「おうちの人はこちら」→ PIN を決めると親画面にファミリーコードが出る。親スマホで同じ URL を開き「おうちの人はこちら」→ 設定 →「別の端末とつなぐ」にそのコードと PIN を入れる

認可は「`x-family-code` ヘッダ = 行の `family_id`」を RLS で突き合わせる方式です。ファミリーコード（6 文字）を知っていれば誰でもその家族のリストを読み書きできる、ゆるい保護です。中身はレゴの欲しい物リストなので MVP として許容していますが、気になる場合は Supabase Auth に置き換えてください。

### 4. 親スマホに通知する（Web Push, 30 分）

1. VAPID 鍵を生成:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. `.env` に `VITE_VAPID_PUBLIC_KEY=<公開鍵>` を追加
3. Edge Function をデプロイ:
   ```bash
   supabase link --project-ref <ref>
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com APP_URL=https://<user>.github.io/brick-wish/
   supabase functions deploy notify-parent
   ```
4. 親スマホで親画面を開き「🔔 通知を許可する」

iPhone は **ホーム画面に追加（PWA としてインストール）してから** 開かないと Web Push が使えません（iOS 16.4 以降）。

> ⚠ `notify-parent` はこの開発環境から Supabase に接続できなかったため **未デプロイ・未実行** です。`supabase functions serve` でローカル確認してから使ってください。

### 5. GitHub Pages に公開

1. `main` に push するとワークフローがビルドして `gh-pages` ブランチに成果物を push する。初回は GitHub が自動で Pages を「gh-pages ブランチから配信」に設定する（されていなければ Settings → Pages → Source: Deploy from a branch → gh-pages / root）
2. Settings → Secrets and variables → Actions → **Variables** に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_VAPID_PUBLIC_KEY` を登録（いずれも公開されて問題ない値。未登録ならローカルモードで動く）
3. URL は `https://<user>.github.io/brick-wish/`

ワークフローは `BASE_PATH=/<repo名>/` でビルドします。独自ドメイン直下に置くなら `/` に変えてください。

## 親の手順

1. 通知（または親画面）で「支払い待ち」を開く。枠超えなら「承認待ち」を開き、数量を調整して「承認して支払いへ」
2. 「ブリッカーズのカートに全部入れる」（shop-map が本物のとき）、または「注文リストをコピー」→「ファイル・リストで注文」に貼り付け
3. ブリッカーズで支払い（PayPay・クレカ・後払い）。送料 230 円、3,300 円以上で無料
4. アプリに戻り「支払ったので『注文済み』にする」（子ども画面に「注文済み」と表示される）

ブリッカーズに在庫が無いパーツがある場合だけ、その分を BrickLink の Wanted List XML に分けて出す（海外・店ごと決済。[仕様](https://www.bricklink.com/help.asp?helpID=207)）。

## 既知の制約・TODO

- 暫定カタログの BrickLink 色 ID・色の存在は未検証（→ `npm run catalog`）
- Rebrickable CDN 画像のホットリンク可否が未確認
- 親子の認可がファミリーコードのみ（Supabase Auth 未対応）
- `notify-parent` Edge Function は未デプロイ・未実行
- Pick a Brick CSV は日本で使えるか未確認
- BrickLink に「複数 Wanted List をまとめて買う」機能はあるが、アプリ側からの自動アップロードはできない（ログイン必須の Web フォームのみ）
- 親画面の BrickLink リンク（`catalogitem.page?P=<番号>&C=<色ID>#T=P`）の `C=` / `#T=P` パラメータはこの開発環境から BrickLink に到達できず未検証。パーツページ自体は `P=` だけで開くはず
- **同梱の shop-map.json はサンプル価格**（`npm run shop-map` で本物に差し替える）。Shopify の `.js` が返す price の単位（×100 想定）、ブリッカーズの「ファイル・リストで注文」の受け付け形式、利用規約での自動取得の可否は未確認
- LEGO 色 ID は 1/26/194/199 以外が記憶ベース（`npm run catalog` で Rebrickable の値に上書き）
- 自動承認の枠は「承認済み・注文済みの見積もり合計」で数える。ショップ側で価格が変わっていても、送信時点の見積もりで判定する
- Web Push の文面（自動承認／承認待ち）は Edge Function を更新したが未デプロイ

## ライセンス

MIT

LEGO®, BrickLink® は LEGO Group の商標です。本プロジェクトは LEGO Group と無関係です。
