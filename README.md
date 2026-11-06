# もじばら

ブレスト用の、文字を並べ替えるだけのシンプルなキャンバス。Vite + TypeScript（依存は実行時ゼロ）。

## 使い方

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを生成
```

`dist/` を静的ホスティング（Cloudflare Pages など）に置けば動きます。フォント（Noto Sans JP）は Google Fonts から読み込みます。

## 操作

| 操作 | 内容 |
| --- | --- |
| クリック | その場で入力。Enter で確定（Shift+Enter で改行）→ 一文字ずつバラバラに |
| ドラッグ | 文字を移動 / 背景ドラッグで画面を移動 |
| ダブルクリック | 一文字を編集（空で確定すると削除、複数文字なら右に追加） |
| 右クリック / 長押し | 色・大きさ・編集・複製・削除 |
| Shift+クリック / ドラッグ | 複数選択 |
| ホイール / ピンチ | 拡大縮小 |
| Space+ドラッグ | 画面を移動 |
| Ctrl/⌘+Z、Shift+Z | 元に戻す、やり直す |
| Ctrl/⌘+A、D、Delete | 全選択、複製、削除 |

内容と表示位置は localStorage（`mojibara:v1`）に自動保存されます。

## 構成

- `src/main.ts` 起動（初期化と各モジュールの読み込み）
- `src/state.ts` データ・履歴（undo/redo）・保存
- `src/tiles.ts` 文字（タイル）の描画・選択・配置・一括操作
- `src/view.ts` パン・ズーム・ドット背景
- `src/editor.ts` 入力欄（新規入力 / 一文字編集）
- `src/pointer.ts` ドラッグ・パン・ピンチ・ホイール・長押し
- `src/keys.ts` キーボードショートカット
- `src/menu.ts` 右クリックメニュー
- `src/toolbar.ts` ツールバー・確認ダイアログ
- `src/dom.ts` / `src/config.ts` / `src/util.ts` DOM 参照・定数・汎用関数
- `src/style.css` 見た目（ライト/ダーク自動切替）

依存は一方向です（循環なし）。`tiles` は表示やツールバーを知らず、変更は `onChange` で通知します。
