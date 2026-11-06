// 選択した文字への操作（色・大きさ・移動・整列・複製・削除）

import { meta, newId, pushUndo, tiles, undoDepth, type Tile } from '../core/state';
import { MAX_SIZE, MIN_SIZE, OFFSET } from '../core/config';
import { clamp } from '../core/util';
import { lineUp, scatter, type Box, type Positions } from './arrange';
import { bounds, changed, ensureEl, els, paintTile, removeTile, select, selected, selectedTiles, worldRect } from './tiles';

export function setColor(key: string): void {
  const list = selectedTiles();
  if (!list.length) return;
  pushUndo();
  for (const t of list) {
    t.color = key;
    const el = els.get(t.id);
    if (el) paintTile(el, t);
  }
  changed();
}

export function resizeSelected(f: number): void {
  const list = selectedTiles();
  if (!list.length) return;
  pushUndo();
  // 選択範囲の中心を基準に、位置と大きさを同じ倍率で変える（単語の並びが崩れない）
  const b = bounds(list);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  for (const t of list) {
    t.size = clamp(t.size * f, MIN_SIZE, MAX_SIZE);
    t.x = cx + (t.x - cx) * f;
    t.y = cy + (t.y - cy) * f;
    const el = els.get(t.id);
    if (el) paintTile(el, t);
  }
  changed();
}

let nudgeAt = 0;
let nudgeDepth = -1;

/**
 * 選択中の文字を少し動かす（矢印キー用）。
 * 押しっぱなしや連打は、元に戻す 1 回分にまとめる。
 */
export function nudgeSelected(dx: number, dy: number): void {
  const list = selectedTiles();
  if (!list.length) return;
  const now = performance.now();
  if (now - nudgeAt > 600 || undoDepth() !== nudgeDepth) {
    pushUndo();
    nudgeDepth = undoDepth();
  }
  nudgeAt = now;
  for (const t of list) {
    t.x += dx;
    t.y += dy;
    const el = els.get(t.id);
    if (el) el.style.translate = `${t.x}px ${t.y}px`;
  }
  changed();
}

/** 位置をまとめて変える（ぬるっと動かす）。元に戻せる */
function moveTo(list: Tile[], pos: Positions): void {
  if (!pos.size) return;
  pushUndo();
  for (const t of list) {
    const p = pos.get(t.id);
    const el = els.get(t.id);
    if (!p || !el) continue;
    t.x = p.x;
    t.y = p.y;
    el.classList.add('arrange');
    paintTile(el, t);
    window.setTimeout(() => el.classList.remove('arrange'), 500);
  }
  changed();
}

function boxesOf(list: Tile[]): Box[] {
  return list.map((t) => ({ id: t.id, ...worldRect(t), size: t.size }));
}

/** 選択した文字を読む順に一列に並べる（2 文字以上） */
export function lineUpSelected(): void {
  const list = selectedTiles();
  if (list.length > 1) moveTo(list, lineUp(boxesOf(list)));
}

/** 選択した文字をばらまく（2 文字以上）。押すたびに並びが変わる */
export function scatterSelected(): void {
  const list = selectedTiles();
  if (list.length > 1) moveTo(list, scatter(boxesOf(list)));
}

export function duplicateSelected(): void {
  const list = selectedTiles().sort((a, b) => a.z - b.z);
  if (!list.length) return;
  pushUndo();
  const copies: string[] = [];
  for (const t of list) {
    const c: Tile = { ...t, id: newId(), x: t.x + OFFSET, y: t.y + OFFSET, z: ++meta.zTop };
    tiles.set(c.id, c);
    ensureEl(c);
    copies.push(c.id);
  }
  select(copies);
  changed();
}

export function deleteSelected(): void {
  if (!selected.size) return;
  pushUndo();
  for (const id of [...selected]) removeTile(id);
  changed();
}

export function deleteAll(): void {
  if (!tiles.size) return;
  pushUndo();
  for (const id of [...tiles.keys()]) removeTile(id);
  changed();
}
