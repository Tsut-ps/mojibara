// 横スナップ：ドラッグ中の文字（または選択範囲）を、近くの文字の左右の端に吸着させる。
// 座標計算だけを行う（DOM には触れない）。

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Target extends Rect {
  id: string;
}

export interface Snap {
  id: string; // 吸着先
  side: 'left' | 'right'; // 吸着先のどちら側にくっつくか
  dx: number; // 吸着のために足す移動量（ワールド座標）
  dy: number; // 行の中心を揃えるための移動量
}

/** 同じ行で、すき間がほぼない（スナップや続けて入力して並んでいる）2 文字か */
export function adjacent(a: Rect, b: Rect): boolean {
  const acy = a.y + a.h / 2;
  const bcy = b.y + b.h / 2;
  if (Math.abs(acy - bcy) > Math.max(a.h, b.h) * 0.6) return false;
  // 左右のすき間（重なっていれば負）。半分より深く重なっているものは別の文字とみなす
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return gap <= Math.min(a.h, b.h) * 0.15 && gap >= -Math.min(a.w, b.w) * 0.5;
}

/** seeds から、隣り合う文字をたどってつながるすべての文字の id を返す */
export function connectedIds(seeds: Iterable<string>, rects: Map<string, Rect>): Set<string> {
  const found = new Set<string>();
  const queue: string[] = [];
  for (const id of seeds) {
    if (rects.has(id) && !found.has(id)) {
      found.add(id);
      queue.push(id);
    }
  }
  while (queue.length) {
    const cur = rects.get(queue.pop() as string) as Rect;
    for (const [id, r] of rects) {
      if (!found.has(id) && adjacent(cur, r)) {
        found.add(id);
        queue.push(id);
      }
    }
  }
  return found;
}

/** いったん吸着したら、新規に吸着するときよりこの倍率だけ遠くまで保つ（ガタつき防止） */
const KEEP = 1.7;

/**
 * group: 動かしている文字の範囲（素の位置）
 * others: 吸着先の候補（動かさない文字）
 * reach: 吸着する距離（ワールド座標）
 * current: 今の吸着状態（あれば優先して保つ）
 */
export function findSnap(
  group: Rect,
  others: Target[],
  reach: number,
  current: Pick<Snap, 'id' | 'side'> | null,
): Snap | null {
  const gcy = group.y + group.h / 2;
  let best: Snap | null = null;
  let bestScore = Infinity;

  for (const o of others) {
    // 同じ行にいる文字だけが対象（縦のずれが小さいもの）
    const ocy = o.y + o.h / 2;
    if (Math.abs(gcy - ocy) > Math.max(group.h, o.h) * 0.6) continue;

    const candidates: Array<['left' | 'right', number]> = [
      ['right', o.x + o.w - group.x], // 相手の右隣に：自分の左端を相手の右端へ
      ['left', o.x - (group.x + group.w)], // 相手の左隣に：自分の右端を相手の左端へ
    ];
    for (const [side, d] of candidates) {
      const holding = current?.id === o.id && current.side === side;
      if (Math.abs(d) > (holding ? reach * KEEP : reach)) continue;
      const score = holding ? Math.abs(d) * 0.5 : Math.abs(d); // 保っている方を少し優先
      if (score < bestScore) {
        bestScore = score;
        best = { id: o.id, side, dx: d, dy: ocy - gcy };
      }
    }
  }
  return best;
}
