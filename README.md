# もじばら

ブレスト用の、文字を並べ替えるだけのシンプルなキャンバス。Vite + TypeScript（依存は実行時ゼロ）。

<img width="1863" height="1077" alt="image" src="https://github.com/user-attachments/assets/2f4d69ce-3fab-43f6-97ff-2d345732fee2" />

## 使い方

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを生成
```

`dist/` を静的ホスティングに置けば動きます。フォント（Noto Sans JP）は Google Fonts から読み込みます。

### Cloudflare にデプロイ

`wrangler.jsonc` が `dist` を静的アセットとして配信します（サーバー処理なし）。
Cloudflare の Git 連携では、ビルドコマンド `npm run build`、デプロイコマンド `npx wrangler deploy` のままで動きます。
`wrangler.jsonc` の `name` は、Cloudflare 側のプロジェクト名と合わせてください。
Node は 20.19 以上（または 22.12 以上）が必要です。古い場合は環境変数 `NODE_VERSION` に `22` を設定します。

## 操作

| 操作 | 内容 |
| --- | --- |
| 背景をクリック | その場で入力。Enter で確定（Shift+Enter で改行）→ 一文字ずつバラバラに。選択中は選択の解除だけ |
| 文字をドラッグ | 移動。横に近づけると隣にカチッと吸着（Alt を押している間は無効） |
| 背景をドラッグ | 範囲選択（Shift・Ctrl/⌘ で今の選択に追加）。タッチは 1 本指で画面を移動 |
| 文字をダブルクリック | 一文字を編集（空で確定すると削除、複数文字なら右に追加） |
| 右クリック / 長押し | 色・大きさ・編集・複製・削除 |
| L / S | 2 文字以上を選択して、一列に整列 / ばらまく |
| W | 選択した文字とつながっている文字（並べた単語）をまとめて選択 |
| 数字キー 1〜8、+ / - | 選択した文字の色（メニューの並び順）、大きさ |
| 矢印キー | 選択した文字を少し動かす（Shift で大きく） |
| Shift または Ctrl/⌘ + クリック | 選択に 1 つずつ追加 / 外す |
| Shift または Ctrl/⌘ + ドラッグ | 押した文字につながった文字（並べた単語）も選択に加えて、まとめて動かす |
| ホイール / ピンチ | 拡大縮小 |
| 中ボタン / Space+ドラッグ | 画面を移動 |
| Ctrl/⌘+Z、Shift+Z | 元に戻す、やり直す |
| 右上のフォルダ | ファイル（JSON）に書き出し / 読み込み（バックアップ・別端末への移動） |
| Ctrl/⌘+C、X、V | コピー、切り取り、貼り付け（配置ごと。ほかのアプリの文字列も貼れる） |
| Ctrl/⌘+A、D、Delete | 全選択、複製、削除 |

内容と表示位置は localStorage（`mojibara:v1`）に自動保存されます。ブラウザのデータはアドレスごとに分かれるため、移すときは右上のフォルダからJSONで書き出して読み込んでください（読み込みは 20000 文字まで、極端に大きな値の文字は読み飛ばします）。効果音のオン/オフは右上のボタンで切り替え、`mojibara:sound` に保存されます。効果音は音声ファイルを使わず、Web Audio で合成しています。

## 構成

- `src/main.ts` 起動（初期化と各モジュールの読み込み）
- `src/state.ts` データ・履歴（undo/redo）・保存
- `src/tiles.ts` 文字（タイル）の描画・選択・配置・一括操作
- `src/view.ts` パン・ズーム・ドット背景
- `src/editor.ts` 入力欄（新規入力 / 一文字編集）
- `src/pointer.ts` ドラッグ・パン・ピンチ・ホイール・長押し
- `src/keys.ts` キーボードショートカット
- `src/snap.ts` 横スナップ・隣接判定の計算（座標だけを扱う）
- `src/arrange.ts` 整列・ばらまきの位置計算（座標だけを扱う）
- `src/clipboard.ts` コピー・切り取り・貼り付け
- `src/data.ts` JSON の書き出し・読み込み
- `src/toast.ts` 画面下の通知（「元に戻す」付き）
- `src/sound.ts` 効果音（Web Audio で合成）
- `src/menu.ts` 右クリックメニュー
- `src/toolbar.ts` ツールバー・確認ダイアログ
- `src/dom.ts` / `src/config.ts` / `src/util.ts` DOM 参照・定数・汎用関数
- `src/style.css` 見た目（ライト/ダーク自動切替）

依存は一方向です（循環なし）。`tiles` は表示やツールバーを知らず、変更は `onChange` で通知します。
