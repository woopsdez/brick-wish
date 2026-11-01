# Brick Wish 🧱

子どもがタブレットで欲しいレゴパーツを選んで「おねがい」し、親がスマホで承認すると、そのまま BrickLink の Wanted List に流して「Buy All」でまとめ買いできる家庭用アプリ。

- **子ども画面**: ひらがな・大きなタイル・色スウォッチ・数量ステッパー。検索はパーツ名/番号。
- **親画面**: 承認待ち一覧 → 内容を数量調整しつつ PIN で承認/見送り → BrickLink Wanted List XML を出力。
- **同期**: Supabase を設定すると親スマホと子タブレットが同期し、Web Push で親に通知。未設定なら 1 台の端末内で完結する「ローカルモード」。
- **ホスティング**: 静的サイト（PWA）。GitHub Pages 用のワークフロー同梱。

## できないこと（先に読んでください）

**「親が承認したら自動で決済まで完了」はできません。** 調査した範囲では、BrickLink / BrickOwl / LEGO Pick a Brick のいずれも、第三者アプリが購入者として注文を確定する公開 API を提供していません。

| ショップ | 分かったこと | このアプリでの扱い |
| --- | --- | --- |
| BrickLink | 公式 API はストア（売り手）向けで、Wanted List や購入はカバー外。コミュニティ製ツールもスクレイピングや XML 手動アップロードで代替している ([PowerShell モジュールの説明](https://awesome.ecosyste.ms/projects/github.com%2Fadbertram%2Fbricklink), [BrickBuddy 拡張](https://chrome.google.com/webstore/detail/brickbuddy/gakoikejnplaodanboajkfchicgbkede)) | Wanted List XML を生成 → 親が BrickLink にアップロード → 「Buy All」→ BrickLink 上で決済 |
| BrickOwl | [公式 API](https://www.brickowl.com/api_docs) に買い手の注文作成はない。Wishlist 追加は Web フォーム POST のみ | 未対応（将来の候補） |
| LEGO Pick a Brick | 公開 API なし。CSV のリストアップロードでカート一括追加できるが、[対応地域が限定](https://brickset.com/article/133221/lists-for-pick-a-brick-live-in-limited-regions-on-lego-com)（記事時点で米国・カナダ）。日本での可否は未確認 | element ID があるパーツだけ CSV 出力（おまけ機能） |

つまり親の操作は「アプリで承認 → BrickLink でアップロード → Buy All → 決済」の 4 手順まで減ります。ゼロにはなりません。

## カタログの方針（ミニメカ向け）

子どもの用途が「Mechabrick / brickmecha 系のミニトランスフォーマー・ミニメカ」なので、同梱カタログは **関節・クリップ・ヒンジ・横向きポッチ・小さいプレート** を中心にした厳選リスト（`scripts/curated-parts.mjs`、167 パーツ）です。カテゴリは「かんせつ」「クリップ・バー」「ヒンジ」「よこむき」「ちいさいプレート」「タイル・スロープ」「まるいの」「テクニック（ちいさい）」「ロボットのぶひん」「タイヤ」「ふつうのブロック」。

関節は Mixel 系ボールジョイント（14417 ボール横 / 14418 受け端 / 14704 受け横）を主軸にしています。ミニメカ向けには Mixel ジョイントが定番という記述は [htbi-moc のガイド](https://htbi-moc.com/blogs/guides/lego-moc-mechs-from-tiny-walkers-to-giant-titans) や [Eurobricks のスレッド](https://www.eurobricks.com/forum/forums/topic/183461-building-a-mech/) にあります。パーツ番号の意味は [BrickOwl 14418](https://www.brickowl.com/catalog/779982) / [BrickOwl 14704](https://www.brickowl.com/catalog/lego-plate-1-x-2-with-middle-ball-joint-socket-14704/comesin) で確認済み。それ以外の番号・色の有無は未検証で、`npm run catalog` が Rebrickable の CSV で実在確認し、無い番号は警告して除外します。

リストを増減したいときは `scripts/curated-parts.mjs` を編集 → `npm run catalog:starter`（即時・未検証）または `npm run catalog`（要 API キー・検証つき）。

## 構成

```
src/
  pages/        Kid / PartPicker / KidCart / KidHistory / ParentGate / Parent / ParentRequest / ParentSettings
  store/        settings(端末設定) / family(ファミリー自動作成) / cart / localStore / supabaseStore / useRequests
  lib/          bricklink(XML・CSV生成) / push(Web Push 購読) / images / ids / config
  catalog/      catalog.json（パーツ・色・カテゴリ）と検索ヘルパー
  sw.ts         Service Worker（プリキャッシュ + push 通知）
scripts/
  curated-parts.mjs   ミニメカ向け厳選パーツリスト（カテゴリ・色・子ども向け名）
  build-catalog.mjs   厳選リストを Rebrickable のデータで検証し catalog.json を生成（要 API キー）
  starter-catalog.mjs 厳選リストから未検証のまま catalog.json を生成（現在同梱されているもの）
  make-icons.mjs      favicon.svg から PWA アイコン PNG を生成
supabase/
  migrations/0001_init.sql        テーブル・RLS
  functions/notify-parent/        Web Push 送信 Edge Function
.github/workflows/pages.yml       GitHub Pages デプロイ
```

## セットアップ

### 1. ローカルで動かす（5 分）

```bash
npm install
npm run dev
```

ブラウザで開くと、いきなり子ども用の「ほしいもの」画面です。パーツを選んで「おねがい」 → 画面下の「おうちの人はこちら」 → 初回だけ PIN を決める → 承認、の順で一通り試せます。PIN は親画面を開くときだけ必要で、タブを閉じるまでは再入力不要です。

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

## 親の注文手順（BrickLink）

1. 親画面でおねがいを開き、数量を調整して「承認して注文へ」
2. 「Wanted List XML をダウンロード」または「XML をコピー」
3. 「BrickLink のアップロード画面を開く」→ Upload タブに XML を貼り付け → 新しい Wanted List として保存
4. Wanted List 一覧 → そのリストの **Buy All** → 店舗の組み合わせが自動提案されるのでカートへ → BrickLink で決済
5. アプリに戻り「注文したことにする」（子ども画面に「ちゅうもんした」と表示される）

XML の仕様: [BrickLink Help – Wanted List Upload](https://www.bricklink.com/help.asp?helpID=207)。`COLOR` は省略可で、省略すると色指定なし。

## 既知の制約・TODO

- 暫定カタログの BrickLink 色 ID・色の存在は未検証（→ `npm run catalog`）
- Rebrickable CDN 画像のホットリンク可否が未確認
- 親子の認可がファミリーコードのみ（Supabase Auth 未対応）
- `notify-parent` Edge Function は未デプロイ・未実行
- Pick a Brick CSV は日本で使えるか未確認
- BrickLink に「複数 Wanted List をまとめて買う」機能はあるが、アプリ側からの自動アップロードはできない（ログイン必須の Web フォームのみ）

## ライセンス

MIT

LEGO®, BrickLink® は LEGO Group の商標です。本プロジェクトは LEGO Group と無関係です。
