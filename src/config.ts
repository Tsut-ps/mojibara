// 定数（見た目の寸法・拡大率の範囲・フォントなど）

export const BASE_SIZE = 36; // 新しい文字の標準サイズ（ワールド単位）

export const PAD_X = 0.06; // タイルの左右パディング(em)。CSS と合わせる

export const GAP = PAD_X * 2; // 並べたタイル同士の追加間隔(em)

export const ROW = 1.45; // 行送り(em)。入力欄の line-height と合わせる

export const GRID = 24; // ドットの間隔（ワールド単位）

export const MIN_S = 0.1;

export const MAX_S = 6;

export const MIN_SIZE = 10;

export const MAX_SIZE = 400;

export const DRAG_PX = 4;

export const LIFT_MAX = 60; // ドラッグ中に影を付ける文字数の上限（多いと描画が重くなる）

export const SNAP_PX = 14; // 横スナップが効く距離（画面上のpx）

export const FONT = '"Noto Sans JP", "Noto Sans", sans-serif';

export const WEIGHT = 500;

export const MOD = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
