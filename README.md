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

## 構成

```
src/
  pages/        Setup / Kid / PartPicker / KidCart / KidHistory / Parent / ParentRequest / ParentSettings
  store/        settings(端末設定) / cart / localStore / supabaseStore / useRequests
  lib/          bricklink(XML・CSV生成) / push(Web Push 購読) / images / ids / config
  catalog/      catalog.json（パーツ・色・カテゴリ）と検索ヘルパー
  sw.ts         Service Worker（プリキャッシュ + push 通知）
scripts/
  build-catalog.mjs   Rebrickable のデータから catalog.json を生成（要 API キー）
  starter-catalog.mjs 手書きの暫定カタログを生成（現在同梱されているもの）
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

ブラウザで開き、「おうちの人」でファミリーコードと PIN を作成 → 設定から「こどもモードにする」 → パーツを選んで「おねがい」 → `#/parent` を開いて PIN を入れて承認、の順で一通り試せます。

### 2. カタログを本物にする（15 分 + ダウンロード時間）

同梱の `src/catalog/catalog.json` は **手書きの暫定版** です。BrickLink の色 ID と「そのパーツにその色が存在するか」は記憶ベースで未検証なので、公開前に必ず差し替えてください。

1. [Rebrickable](https://rebrickable.com/) でアカウントを作り、[API キー](https://rebrickable.com/api/)を取得
2. 実行:
   ```bash
   REBRICKABLE_API_KEY=xxxx npm run catalog -- --top 40 --min-sets 30
   ```
   - CSV（parts / colors / elements / inventory_parts など）を `scripts/.cache/` にダウンロード。inventory_parts は数十 MB
   - カテゴリごとに「収録セット数」上位 `--top` 件を選ぶ
   - API から BrickLink のパーツ ID と色 ID を取得（レート制限対策で 1 秒待ちを入れている）
3. `name_ja`（子ども向け名）は暫定カタログにあるものを引き継ぎ、それ以外は英名のまま。必要なら JSON を直接編集

画像は Rebrickable の CDN（`cdn.rebrickable.com`）を直接参照しています。**ホットリンクの可否は未確認** なので、公開運用前に Rebrickable の利用規約を確認するか、画像を自サイトに同梱する処理を追加してください。

### 3. 親スマホと同期する（Supabase, 30 分）

1. [Supabase](https://supabase.com/) でプロジェクト作成
2. `supabase/migrations/0001_init.sql` を SQL Editor で実行
3. `.env` に設定:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. 親スマホ・子タブレットの両方で同じ URL を開き、同じファミリーコードを使う

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

1. リポジトリ Settings → Pages → Source を「GitHub Actions」に
2. Settings → Secrets and variables → Actions → **Variables** に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_VAPID_PUBLIC_KEY` を登録（いずれも公開されて問題ない値。未登録ならローカルモードで動く）
3. `main` に push するとデプロイ。URL は `https://<user>.github.io/brick-wish/`

ワークフローは `BASE_PATH=/<repo名>/` でビルドします。独自ドメイン直下に置くなら `/` に変えてください。

## 親の注文手順（BrickLink）

1. 親画面でおねがいを開き、数量を調整して PIN で「承認して注文へ」
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
