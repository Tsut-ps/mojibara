# もじばら

ブレスト用の、文字を並べ替えるだけのシンプルなキャンバス。Vite + TypeScript（依存は実行時ゼロ）。

## 使い方

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # dist/index.html（1ファイル）を生成
```

`dist/index.html` はそれだけで動きます。フォント（Noto Sans JP）は Google Fonts から読み込みます。

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

- `src/state.ts` データ・履歴（undo/redo）・保存
- `src/main.ts` 描画と操作
- `src/style.css` 見た目（ライト/ダーク自動切替）
