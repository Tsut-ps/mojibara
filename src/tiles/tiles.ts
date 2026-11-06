// タイル（文字）の描画・選択・変更の通知（選択した文字への操作は actions.ts）

import { meta, newId, saveSoon, tiles, type Tile } from '../core/state';
import { GAP, ROW } from '../core/config';
import { world } from '../core/dom';
import { connectedIds } from './snap';
import { graphemes, measure } from '../core/util';

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
