// 整列・ばらまきの位置計算（座標だけを扱い、DOM には触れない）

import { GAP } from './config';

export interface Box {
  id: string;
  x: number; // 左上（ワールド座標）
  y: number;
  w: number;
  h: number;
  size: number; // フォントサイズ
}

export type Positions = Map<string, { x: number; y: number }>;

const cyOf = (b: Box) => b.y + b.h / 2;

/** 読む順（上の行から、各行は左から右）に並べる */
export function readingOrder(boxes: Box[]): Box[] {
  const byY = [...boxes].sort((a, b) => cyOf(a) - cyOf(b));
  const rows: Box[][] = [];
  for (const b of byY) {
    const row = rows[rows.length - 1];
    if (row) {
      const mean = row.reduce((s, r) => s + cyOf(r), 0) / row.length;
      if (Math.abs(cyOf(b) - mean) <= Math.max(b.h, row[0].h) * 0.6) {
        row.push(b);
        continue;
      }
    }
    rows.push([b]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

function extent(boxes: Box[]) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** 読む順に、一列に（入力したときと同じ間隔で）並べる。選択範囲の左端・縦の中央が基準 */
export function lineUp(boxes: Box[]): Positions {
  const out: Positions = new Map();
  if (!boxes.length) return out;
  const e = extent(boxes);
  const cy = e.y + e.h / 2;
  let x = e.x;
  for (const b of readingOrder(boxes)) {
    out.set(b.id, { x, y: cy - b.h / 2 });
    x += b.w + b.size * GAP;
  }
  return out;
}

/** 選択範囲のまわりに、なるべく重ならないようにばらまく */
export function scatter(boxes: Box[], rand: () => number = Math.random): Positions {
  const out: Positions = new Map();
  const n = boxes.length;
  if (n < 2) return out;
  const e = extent(boxes);
  const area = boxes.reduce((s, b) => s + b.w * b.h, 0);
  // 文字の面積の 6 倍ほどの広さ（横長）。もともとの範囲より狭くはしない
  const side = Math.sqrt(area * 6);
  const W = Math.max(e.w * 1.3, side * 1.25);
  const H = Math.max(e.h * 1.3, side * 0.8);
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  // 先に置く文字が有利にならないよう順番をシャッフルし、大きい文字から置く
  const order = [...boxes];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.sort((a, b) => b.w * b.h - a.w * a.h);

  const placed: Array<{ cx: number; cy: number; r: number }> = [];
  for (const b of order) {
    const r = Math.hypot(b.w, b.h) / 2;
    let best = { x: cx, y: cy };
    let bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const px = cx + (rand() - 0.5) * (W - b.w);
      const py = cy + (rand() - 0.5) * (H - b.h);
      // 置いた文字との「すき間」の最小値が大きい場所ほどよい
      let gap = Infinity;
      for (const p of placed) gap = Math.min(gap, Math.hypot(px - p.cx, py - p.cy) - p.r - r);
      if (gap > bestScore) {
        bestScore = gap;
        best = { x: px, y: py };
      }
    }
    placed.push({ cx: best.x, cy: best.y, r });
    out.set(b.id, { x: best.x - b.w / 2, y: best.y - b.h / 2 });
  }
  return out;
}
