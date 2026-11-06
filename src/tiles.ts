// タイル（文字）の描画・選択・配置・一括操作

import { meta, newId, pushUndo, saveSoon, tiles, undoDepth, type Tile } from './state';
import { GAP, MAX_SIZE, MIN_SIZE, ROW } from './config';
import { world } from './dom';
import { lineUp, scatter, type Box, type Positions } from './arrange';
import { connectedIds } from './snap';
import { clamp, graphemes, measure } from './util';

export const els = new Map<string, HTMLDivElement>();

export const selected = new Set<string>();

export function paintTile(el: HTMLElement, t: Tile): void {
  el.textContent = t.ch;
  el.dataset.id = t.id;
  el.style.fontSize = `${t.size}px`;
  el.style.translate = `${t.x}px ${t.y}px`;
  el.style.color = `var(--c-${t.color})`;
  el.style.zIndex = String(t.z);
}

export function ensureEl(t: Tile): HTMLDivElement {
  let el = els.get(t.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'tile';
    world.appendChild(el);
    els.set(t.id, el);
  }
  paintTile(el, t);
  return el;
}

export function removeTile(id: string): void {
  tiles.delete(id);
  els.get(id)?.remove();
  els.delete(id);
  selected.delete(id);
}

export function refreshSelection(): void {
  for (const [id, el] of els) el.classList.toggle('selected', selected.has(id));
}

export function select(ids: Iterable<string>): void {
  selected.clear();
  for (const id of ids) selected.add(id);
  refreshSelection();
}

export function selectedTiles(): Tile[] {
  const out: Tile[] = [];
  for (const id of selected) {
    const t = tiles.get(id);
    if (t) out.push(t);
  }
  return out;
}

/** データとタイル DOM を完全に一致させる（読み込み・undo/redo 後） */
export function syncAll(): void {
  for (const [id, el] of els) {
    if (!tiles.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
  for (const id of [...selected]) if (!tiles.has(id)) selected.delete(id);
  for (const t of tiles.values()) ensureEl(t);
  refreshSelection();
}

const changeListeners: Array<() => void> = [];

/** データや編集状態が変わったときに呼ぶ関数を登録する */
export function onChange(fn: () => void): void {
  changeListeners.push(fn);
}

export function notify(): void {
  for (const fn of changeListeners) fn();
}

/** データ変更後の共通処理 */
export function changed(): void {
  saveSoon();
  notify();
}

export function worldRect(t: Tile) {
  const el = els.get(t.id);
  return { x: t.x, y: t.y, w: el?.offsetWidth ?? t.size, h: el?.offsetHeight ?? t.size };
}

export function bounds(list: Tile[]) {
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const t of list) {
    const r = worldRect(t);
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

interface Laid {
  tile: Tile;
  cx: number; // 出現アニメの開始位置（詰めた状態）
}

export function layoutText(text: string, x0: number, y0: number, size: number, color: string): Laid[] {
  const out: Laid[] = [];
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  lines.forEach((line, row) => {
    const y = y0 + row * size * ROW;
    let fx = x0;
    let cx = x0;
    for (const g of graphemes(line)) {
      const w = g === '\t' ? size * 2 : measure(g, size);
      if (!/^\s+$/.test(g)) {
        out.push({ tile: { id: newId(), ch: g, x: fx, y, size, color, z: 0 }, cx });
      }
      fx += w + size * GAP;
      cx += w;
    }
  });
  return out;
}

/** タイルを追加し、入力欄の位置から散らばるアニメーションを付ける */
export function addTiles(laid: Laid[]): Tile[] {
  const created: Tile[] = [];
  laid.forEach(({ tile, cx }, i) => {
    tile.z = ++meta.zTop;
    tiles.set(tile.id, tile);
    const el = ensureEl(tile);
    el.style.translate = `${cx}px ${tile.y}px`;
    el.style.setProperty('--d', `${Math.min(i * 14, 280)}ms`);
    el.classList.add('spawn');
    created.push(tile);
  });
  void world.offsetWidth; // 開始位置を確定させてから最終位置へ
  for (const t of created) {
    const el = els.get(t.id);
    if (el) el.style.translate = `${t.x}px ${t.y}px`;
  }
  window.setTimeout(() => {
    for (const t of created) els.get(t.id)?.classList.remove('spawn');
  }, 900);
  return created;
}

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
    const c: Tile = { ...t, id: newId(), x: t.x + 24, y: t.y + 24, z: ++meta.zTop };
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

/** seeds とつながっている文字（スナップで並べた単語など）の id を、seeds を含めて返す */
export function connectedOf(seeds: Iterable<string>): Set<string> {
  const rects = new Map<string, ReturnType<typeof worldRect>>();
  for (const t of tiles.values()) rects.set(t.id, worldRect(t));
  return connectedIds(seeds, rects);
}

/** 選択中の文字とつながっている文字をまとめて選択する */
export function selectConnected(): void {
  if (selected.size) select(connectedOf([...selected]));
}

export function selectAll(): void {
  select(tiles.keys());
}

export function bringToFront(list: Tile[]): void {
  for (const t of [...list].sort((a, b) => a.z - b.z)) {
    t.z = ++meta.zTop;
    const el = els.get(t.id);
    if (el) el.style.zIndex = String(t.z);
  }
}
