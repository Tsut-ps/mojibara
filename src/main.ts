import './style.css';
import {
  COLORS,
  canRedo,
  canUndo,
  flushSave,
  load,
  meta,
  newId,
  pushUndo,
  redo,
  saveSoon,
  tiles,
  undo,
  view,
  type Tile,
  type View,
} from './state';

// ======================================================================
// 定数
// ======================================================================

const BASE_SIZE = 36; // 新しい文字の標準サイズ（ワールド単位）
const PAD_X = 0.06; // タイルの左右パディング(em)。CSS と合わせる
const GAP = PAD_X * 2; // 並べたタイル同士の追加間隔(em)
const ROW = 1.45; // 行送り(em)。入力欄の line-height と合わせる
const GRID = 24; // ドットの間隔（ワールド単位）
const MIN_S = 0.1;
const MAX_S = 6;
const MIN_SIZE = 10;
const MAX_SIZE = 400;
const DRAG_PX = 4;
const FONT = '"Noto Sans JP", "Noto Sans", sans-serif';
const WEIGHT = 500;
const MOD = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';

// ======================================================================
// DOM
// ======================================================================

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
}

const stage = byId('stage');
const world = byId('world');
const marquee = byId('marquee');
const editor = byId<HTMLTextAreaElement>('editor');
const menu = byId('menu');
const confirmDlg = byId<HTMLDialogElement>('confirm');
const undoBtn = byId<HTMLButtonElement>('undo');
const redoBtn = byId<HTMLButtonElement>('redo');
const clearBtn = byId<HTMLButtonElement>('clear');
const zoomLabel = byId('zoom-reset');

const ICONS: Record<string, string> = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  grow: '<path d="M3 19 8 6l5 13M5 14h6"/><path d="M19 4v6M16 7h6"/>',
  shrink: '<path d="M3 19 8 6l5 13M5 14h6"/><path d="M16 7h6"/>',
  select: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
  type: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
};

function svg(name: string): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = svg(el.dataset.icon ?? '');
});

// ======================================================================
// ユーティリティ
// ======================================================================

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

function graphemes(s: string): string[] {
  return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
}

const mctx = document.createElement('canvas').getContext('2d');
function measure(text: string, px: number): number {
  if (!mctx) return text.length * px;
  mctx.font = `${WEIGHT} ${px}px ${FONT}`;
  return mctx.measureText(text).width;
}

/** 使う文字のフォントを先に読み込む（オフラインなどで待ち続けないよう上限付き） */
async function ensureFont(text: string): Promise<void> {
  try {
    await Promise.race([document.fonts.load(`${WEIGHT} 36px ${FONT}`, text), sleep(600)]);
  } catch {
    /* フォールバックフォントのまま続行 */
  }
}

// ======================================================================
// 表示（パン・ズーム・ドット背景）
// ======================================================================

function applyView(): void {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  world.style.setProperty('--inv', String(1 / view.s));

  // ドットは画面上で細かすぎず粗すぎない間隔になるよう 2 倍/半分に切り替える
  let gap = GRID * view.s;
  while (gap < 14) gap *= 2;
  while (gap > 56) gap /= 2;
  stage.style.setProperty('--gap', `${gap}px`);
  stage.style.setProperty('--ox', `${view.x - gap / 2}px`);
  stage.style.setProperty('--oy', `${view.y - gap / 2}px`);
  stage.style.setProperty('--dot-r', `${clamp(view.s * 1.1, 0.9, 1.7)}px`);

  zoomLabel.textContent = `${Math.round(view.s * 100)}%`;
  positionEditor();
  saveSoon();
}

function zoomTarget(factor: number, cx: number, cy: number): View {
  const s = clamp(view.s * factor, MIN_S, MAX_S);
  const k = s / view.s;
  return { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, s };
}

function zoomAt(factor: number, cx: number, cy: number): void {
  Object.assign(view, zoomTarget(factor, cx, cy));
  applyView();
}

let tweenId = 0;
const cancelTween = () => void tweenId++;

function tweenTo(target: View, ms = 260): void {
  const id = ++tweenId;
  const from = { ...view };
  const t0 = performance.now();
  const step = (now: number) => {
    if (id !== tweenId) return;
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    view.x = from.x + (target.x - from.x) * e;
    view.y = from.y + (target.y - from.y) * e;
    view.s = from.s + (target.s - from.s) * e;
    applyView();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const screenToWorld = (px: number, py: number) => ({
  x: (px - view.x) / view.s,
  y: (py - view.y) / view.s,
});

// ======================================================================
// タイル（DOM 反映）
// ======================================================================

const els = new Map<string, HTMLDivElement>();
const selected = new Set<string>();

function paintTile(el: HTMLElement, t: Tile): void {
  el.textContent = t.ch;
  el.dataset.id = t.id;
  el.style.fontSize = `${t.size}px`;
  el.style.translate = `${t.x}px ${t.y}px`;
  el.style.color = `var(--c-${t.color})`;
  el.style.zIndex = String(t.z);
}

function ensureEl(t: Tile): HTMLDivElement {
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

function removeTile(id: string): void {
  tiles.delete(id);
  els.get(id)?.remove();
  els.delete(id);
  selected.delete(id);
}

function refreshSelection(): void {
  for (const [id, el] of els) el.classList.toggle('selected', selected.has(id));
}

function select(ids: Iterable<string>): void {
  selected.clear();
  for (const id of ids) selected.add(id);
  refreshSelection();
}

function selectedTiles(): Tile[] {
  const out: Tile[] = [];
  for (const id of selected) {
    const t = tiles.get(id);
    if (t) out.push(t);
  }
  return out;
}

/** データとタイル DOM を完全に一致させる（読み込み・undo/redo 後） */
function syncAll(): void {
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

function syncUi(): void {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();
  clearBtn.disabled = tiles.size === 0;
  document.body.classList.toggle('is-empty', tiles.size === 0 && !edit);
}

/** データ変更後の共通処理 */
function changed(): void {
  saveSoon();
  syncUi();
}

function worldRect(t: Tile) {
  const el = els.get(t.id);
  return { x: t.x, y: t.y, w: el?.offsetWidth ?? t.size, h: el?.offsetHeight ?? t.size };
}

function bounds(list: Tile[]) {
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

// ======================================================================
// 文字の配置（入力した文字列 → 一文字ずつのタイル）
// ======================================================================

interface Laid {
  tile: Tile;
  cx: number; // 出現アニメの開始位置（詰めた状態）
}

function layoutText(text: string, x0: number, y0: number, size: number, color: string): Laid[] {
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
function addTiles(laid: Laid[]): Tile[] {
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

// ======================================================================
// 入力欄（新規入力 / 一文字編集）
// ======================================================================

interface EditCtx {
  mode: 'new' | 'edit';
  id?: string;
  x: number; // ワールド座標。タイル左上に相当
  y: number;
  size: number;
  color: string;
}

let edit: EditCtx | null = null;

function openNew(clientX: number, clientY: number): void {
  const p = screenToWorld(clientX, clientY);
  // 画面上で 16〜72px に収まるよう、拡大率に応じて大きさを決める
  const size = Math.round(clamp(BASE_SIZE, 16 / view.s, 72 / view.s));
  openEditor({
    mode: 'new',
    x: p.x - PAD_X * size,
    y: p.y - 0.675 * size, // ポインタ位置が 1 行目の中央になるように
    size,
    color: 'ink',
  });
}

function openEdit(id: string): void {
  const t = tiles.get(id);
  if (!t) return;
  els.get(id)?.classList.add('editing');
  openEditor({ mode: 'edit', id, x: t.x, y: t.y, size: t.size, color: t.color }, t.ch);
}

function openEditor(ctx: EditCtx, initial = ''): void {
  closeMenu();
  edit = ctx;
  editor.value = initial;
  editor.style.color = `var(--c-${ctx.color})`;
  editor.hidden = false;
  document.body.classList.add('editing');
  syncUi();
  positionEditor();
  editor.focus();
  editor.select();
  void ensureFont(initial).then(fitEditor);
}

function positionEditor(): void {
  if (!edit) return;
  const fs = edit.size * view.s;
  editor.style.fontSize = `${fs}px`;
  editor.style.left = `${view.x + edit.x * view.s}px`;
  // 入力欄の行(1.45em)の中央とタイルの文字の中央を揃える
  editor.style.top = `${view.y + (edit.y - 0.05 * edit.size) * view.s}px`;
  fitEditor();
}

function fitEditor(): void {
  if (!edit) return;
  const fs = edit.size * view.s;
  const lines = editor.value.split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, measure(l, fs));
  editor.style.width = `${Math.ceil(w + fs * PAD_X * 2 + fs * 0.6)}px`;
  editor.rows = Math.max(1, lines.length);
}

function closeEditor(): void {
  edit = null;
  editor.hidden = true;
  editor.value = '';
  document.body.classList.remove('editing');
  syncUi();
}

function cancelEdit(): void {
  if (!edit) return;
  const id = edit.id;
  closeEditor();
  if (id) els.get(id)?.classList.remove('editing');
}

function commitEdit(): void {
  if (!edit) return;
  const ctx = edit;
  const text = editor.value;
  closeEditor();
  void finishEdit(ctx, text);
}

async function finishEdit(ctx: EditCtx, text: string): Promise<void> {
  if (ctx.mode === 'new') {
    if (!text.trim()) return;
    await ensureFont(text);
    pushUndo();
    addTiles(layoutText(text, ctx.x, ctx.y, ctx.size, ctx.color));
    select([]); // 入力直後は未選択にして、一文字ずつ個別にドラッグできるようにする
    changed();
    return;
  }

  const id = ctx.id ?? '';
  const t = tiles.get(id);
  const el = els.get(id);
  try {
    if (!t || text === t.ch) return;
    await ensureFont(text);
    const laid = layoutText(text, t.x, t.y, t.size, t.color);
    pushUndo();
    if (laid.length === 0) {
      // 空にして確定 → その文字を削除
      removeTile(id);
      changed();
      return;
    }
    // 先頭は既存タイルを書き換え、2 文字目以降は右に新しいタイルとして追加
    const [first, ...rest] = laid;
    t.ch = first.tile.ch;
    t.x = first.tile.x;
    t.y = first.tile.y;
    paintTile(el ?? ensureEl(t), t);
    addTiles(rest);
    select([t.id]);
    changed();
  } finally {
    el?.classList.remove('editing');
  }
}

editor.addEventListener('keydown', (e) => {
  // IME の変換確定 Enter は無視（Safari は keyCode 229）
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
  }
});
editor.addEventListener('input', () => {
  fitEditor();
  void ensureFont(editor.value).then(fitEditor);
});
editor.addEventListener('blur', commitEdit);

// ======================================================================
// 操作（選択中のタイルに対する処理）
// ======================================================================

function setColor(key: string): void {
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

function resizeSelected(f: number): void {
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

function duplicateSelected(): void {
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

function deleteSelected(): void {
  if (!selected.size) return;
  pushUndo();
  for (const id of [...selected]) removeTile(id);
  changed();
}

function deleteAll(): void {
  if (!tiles.size) return;
  pushUndo();
  for (const id of [...tiles.keys()]) removeTile(id);
  changed();
}

function selectAll(): void {
  select(tiles.keys());
}

function editSelected(): void {
  if (selected.size !== 1) return;
  const [id] = selected;
  setTimeout(() => openEdit(id), 0);
}

function bringToFront(list: Tile[]): void {
  for (const t of [...list].sort((a, b) => a.z - b.z)) {
    t.z = ++meta.zTop;
    const el = els.get(t.id);
    if (el) el.style.zIndex = String(t.z);
  }
}

function doUndo(): void {
  if (edit) return;
  if (undo()) {
    syncAll();
    changed();
  }
}
function doRedo(): void {
  if (edit) return;
  if (redo()) {
    syncAll();
    changed();
  }
}

function askDeleteAll(): void {
  if (!tiles.size) return;
  byId('confirm-count').textContent = String(tiles.size);
  confirmDlg.showModal();
}
confirmDlg.addEventListener('close', () => {
  if (confirmDlg.returnValue === 'ok') deleteAll();
  confirmDlg.returnValue = '';
});

function fitAll(): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!tiles.size) {
    tweenTo({ x: W / 2, y: H / 2, s: 1 });
    return;
  }
  const b = bounds([...tiles.values()]);
  const s = clamp(Math.min((W - 120) / Math.max(b.w, 1), (H - 160) / Math.max(b.h, 1)), MIN_S, 2);
  tweenTo({
    x: W / 2 - (b.x + b.w / 2) * s,
    y: H / 2 - (b.y + b.h / 2) * s,
    s,
  });
}

// ======================================================================
// 右クリックメニュー
// ======================================================================

type MenuEntry =
  | { type: 'item'; label: string; icon: string; hint?: string; danger?: boolean; keep?: boolean; run: () => void }
  | { type: 'sep' }
  | { type: 'caption'; text: string }
  | { type: 'colors'; current: string | null };

function showMenu(x: number, y: number, entries: MenuEntry[]): void {
  menu.replaceChildren();
  for (const en of entries) {
    if (en.type === 'sep') {
      const d = document.createElement('div');
      d.className = 'msep';
      menu.appendChild(d);
    } else if (en.type === 'caption') {
      const d = document.createElement('div');
      d.className = 'mcap';
      d.textContent = en.text;
      menu.appendChild(d);
    } else if (en.type === 'colors') {
      const row = document.createElement('div');
      row.className = 'swatches';
      for (const c of COLORS) {
        const b = document.createElement('button');
        b.className = 'sw' + (en.current === c.key ? ' current' : '');
        b.style.setProperty('--c', `var(--c-${c.key})`);
        b.title = c.label;
        b.setAttribute('aria-label', c.label);
        b.addEventListener('click', () => {
          closeMenu();
          setColor(c.key);
        });
        row.appendChild(b);
      }
      menu.appendChild(row);
    } else {
      const b = document.createElement('button');
      b.className = 'mi' + (en.danger ? ' danger' : '');
      b.setAttribute('role', 'menuitem');
      b.innerHTML = `${svg(en.icon)}<span></span>${en.hint ? '<span class="hint"></span>' : ''}`;
      const spans = b.querySelectorAll('span');
      spans[0].textContent = en.label;
      if (en.hint && spans[1]) spans[1].textContent = en.hint;
      b.addEventListener('click', () => {
        if (!en.keep) closeMenu();
        en.run();
      });
      menu.appendChild(b);
    }
  }
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${clamp(x, 8, window.innerWidth - r.width - 8)}px`;
  menu.style.top = `${clamp(y, 8, window.innerHeight - r.height - 8)}px`;
}

function closeMenu(): void {
  menu.hidden = true;
}

function showTileMenu(x: number, y: number): void {
  const list = selectedTiles();
  const n = list.length;
  const colors = new Set(list.map((t) => t.color));
  const entries: MenuEntry[] = [];
  if (n > 1) entries.push({ type: 'caption', text: `${n}文字を選択中` });
  entries.push({ type: 'colors', current: colors.size === 1 ? [...colors][0] : null });
  entries.push({ type: 'sep' });
  entries.push({ type: 'item', label: '大きく', icon: 'grow', keep: true, run: () => resizeSelected(1.25) });
  entries.push({ type: 'item', label: '小さく', icon: 'shrink', keep: true, run: () => resizeSelected(0.8) });
  if (n === 1) entries.push({ type: 'item', label: '編集', icon: 'edit', hint: 'Enter', run: editSelected });
  entries.push({ type: 'item', label: '複製', icon: 'copy', hint: `${MOD}D`, run: duplicateSelected });
  entries.push({ type: 'sep' });
  entries.push({ type: 'item', label: '削除', icon: 'trash', hint: 'Del', danger: true, run: deleteSelected });
  showMenu(x, y, entries);
}

function showBgMenu(x: number, y: number): void {
  showMenu(x, y, [
    { type: 'item', label: 'ここに入力', icon: 'type', run: () => setTimeout(() => openNew(x, y), 0) },
    { type: 'item', label: 'すべて選択', icon: 'select', hint: `${MOD}A`, run: selectAll },
    { type: 'item', label: '全体を表示', icon: 'fit', run: fitAll },
    { type: 'sep' },
    { type: 'item', label: 'すべて削除', icon: 'trash', danger: true, run: askDeleteAll },
  ]);
}

function openContextAt(x: number, y: number, tileEl: Element | null): void {
  cancelLongPress();
  drag = null;
  pointers.clear();
  stage.classList.remove('dragging', 'panning');
  if (tileEl instanceof HTMLElement && tileEl.dataset.id) {
    if (!selected.has(tileEl.dataset.id)) select([tileEl.dataset.id]);
    showTileMenu(x, y);
  } else {
    showBgMenu(x, y);
  }
}

// 外側を押したらメニューを閉じる
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node)) closeMenu();
  },
  true,
);

// ======================================================================
// ポインタ操作（移動・選択・パン・ピンチ・ダブルクリック・長押し）
// ======================================================================

type Drag =
  | {
      kind: 'tiles';
      id: string;
      startX: number;
      startY: number;
      moved: boolean;
      additive: boolean;
      wasSelected: boolean;
      orig: Map<string, { x: number; y: number }>;
    }
  | { kind: 'pan'; startX: number; startY: number; vx: number; vy: number; moved: boolean; bgTap: boolean }
  | { kind: 'marquee'; startX: number; startY: number; base: Set<string> }
  | { kind: 'pinch'; dist: number; sx: number; sy: number; s: number; wx: number; wy: number };

const pointers = new Map<number, { x: number; y: number }>();
let drag: Drag | null = null;
let spaceDown = false;
let tapPending = false; // 背景をタップした → click で入力欄を開く（iOS でキーボードを出すため）
let lastTap: { id: string; t: number; x: number; y: number } | null = null;
let lpTimer = 0;

function cancelLongPress(): void {
  window.clearTimeout(lpTimer);
}

stage.addEventListener('pointerdown', (e) => {
  cancelTween();
  tapPending = false;
  if (e.button === 2) return; // 右クリックは contextmenu で処理

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.setPointerCapture(e.pointerId);

  if (pointers.size === 2) {
    startPinch();
    return;
  }
  if (pointers.size > 2) return;

  const tileEl = (e.target as Element).closest('.tile');

  // 長押し → メニュー（iOS など contextmenu が出ない環境向け）
  if (e.pointerType !== 'mouse') {
    const { clientX, clientY } = e;
    lpTimer = window.setTimeout(() => {
      const d = drag;
      if (!d || pointers.size !== 1) return;
      if ((d.kind === 'tiles' || d.kind === 'pan') && !d.moved) openContextAt(clientX, clientY, tileEl);
    }, 550);
  }

  // 中ボタン / Space 押下中 → パン
  if (e.button === 1 || spaceDown) {
    e.preventDefault();
    drag = { kind: 'pan', startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y, moved: true, bgTap: false };
    stage.classList.add('panning');
    return;
  }

  const additive = e.shiftKey || e.metaKey || e.ctrlKey;

  if (tileEl instanceof HTMLElement && tileEl.dataset.id) {
    const id = tileEl.dataset.id;
    const wasSelected = selected.has(id);
    if (additive) {
      if (!wasSelected) {
        selected.add(id);
        refreshSelection();
      }
    } else if (!wasSelected) {
      select([id]);
    }
    const orig = new Map<string, { x: number; y: number }>();
    for (const t of selectedTiles()) orig.set(t.id, { x: t.x, y: t.y });
    drag = { kind: 'tiles', id, startX: e.clientX, startY: e.clientY, moved: false, additive, wasSelected, orig };
    return;
  }

  if (additive) {
    drag = { kind: 'marquee', startX: e.clientX, startY: e.clientY, base: new Set(selected) };
    return;
  }

  drag = { kind: 'pan', startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y, moved: false, bgTap: true };
});

stage.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  const d = drag;
  if (!d) return;

  if (d.kind === 'pinch') {
    updatePinch(d);
    return;
  }

  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;

  if (d.kind === 'tiles') {
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      cancelLongPress();
      pushUndo();
      const list = selectedTiles();
      bringToFront(list);
      for (const t of list) els.get(t.id)?.classList.remove('spawn');
      stage.classList.add('dragging');
    }
    for (const [id, o] of d.orig) {
      const t = tiles.get(id);
      const el = els.get(id);
      if (!t || !el) continue;
      t.x = o.x + dx / view.s;
      t.y = o.y + dy / view.s;
      el.style.translate = `${t.x}px ${t.y}px`;
    }
    changed();
  } else if (d.kind === 'pan') {
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      cancelLongPress();
      stage.classList.add('panning');
    }
    view.x = d.vx + dx;
    view.y = d.vy + dy;
    applyView();
  } else if (d.kind === 'marquee') {
    const x1 = Math.min(d.startX, e.clientX);
    const y1 = Math.min(d.startY, e.clientY);
    const x2 = Math.max(d.startX, e.clientX);
    const y2 = Math.max(d.startY, e.clientY);
    marquee.hidden = false;
    Object.assign(marquee.style, {
      left: `${x1}px`,
      top: `${y1}px`,
      width: `${x2 - x1}px`,
      height: `${y2 - y1}px`,
    });
    const hits = new Set(d.base);
    for (const [id, el] of els) {
      const r = el.getBoundingClientRect();
      if (r.right >= x1 && r.left <= x2 && r.bottom >= y1 && r.top <= y2) hits.add(id);
    }
    select(hits);
  }
});

function onPointerEnd(e: PointerEvent): void {
  if (!pointers.delete(e.pointerId)) return;
  cancelLongPress();
  const d = drag;
  if (!d) return;
  if (d.kind === 'pinch') {
    if (pointers.size < 2) drag = null;
    return;
  }
  drag = null;
  stage.classList.remove('dragging', 'panning');
  const ok = e.type === 'pointerup';

  if (d.kind === 'tiles') {
    if (d.moved || !ok) return;
    // ここからは「動かさずに離した」＝タップ
    if (d.additive) {
      if (d.wasSelected) {
        selected.delete(d.id);
        refreshSelection();
      }
      return;
    }
    if (selected.size > 1) select([d.id]);
    const now = performance.now();
    if (
      lastTap &&
      lastTap.id === d.id &&
      now - lastTap.t < 400 &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 10
    ) {
      lastTap = null;
      setTimeout(() => {
        select([d.id]);
        openEdit(d.id);
      }, 0);
    } else {
      lastTap = { id: d.id, t: now, x: e.clientX, y: e.clientY };
    }
  } else if (d.kind === 'pan') {
    if (d.bgTap && !d.moved && ok) {
      if (selected.size) select([]);
      tapPending = true;
    }
  } else if (d.kind === 'marquee') {
    marquee.hidden = true;
  }
}
stage.addEventListener('pointerup', onPointerEnd);
stage.addEventListener('pointercancel', onPointerEnd);

stage.addEventListener('click', (e) => {
  if (!tapPending) return;
  tapPending = false;
  openNew(e.clientX, e.clientY);
});

stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  openContextAt(e.clientX, e.clientY, (e.target as Element).closest('.tile'));
});

// ---- ピンチ（2 本指）----

function startPinch(): void {
  cancelLongPress();
  stage.classList.remove('dragging', 'panning');
  const [a, b] = [...pointers.values()];
  const sx = (a.x + b.x) / 2;
  const sy = (a.y + b.y) / 2;
  const w = screenToWorld(sx, sy);
  drag = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, sx, sy, s: view.s, wx: w.x, wy: w.y };
}

function updatePinch(d: Extract<Drag, { kind: 'pinch' }>): void {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const s = clamp(d.s * (Math.hypot(a.x - b.x, a.y - b.y) / d.dist), MIN_S, MAX_S);
  view.s = s;
  view.x = cx - d.wx * s;
  view.y = cy - d.wy * s;
  applyView();
}

// ---- ホイール / トラックパッドのピンチ ----

stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    cancelTween();
    closeMenu();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    dy = clamp(dy, -120, 120);
    zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
  },
  { passive: false },
);

// Mac Safari のトラックパッドピンチ（gesture イベント。タッチ中は pointer 側で処理済み）
let gestureStartS = 1;
const onGesture = (type: 'start' | 'change') => (ev: Event) => {
  const e = ev as Event & { scale: number; clientX: number; clientY: number };
  e.preventDefault();
  if (pointers.size) return;
  if (type === 'start') gestureStartS = view.s;
  else zoomAt(clamp(gestureStartS * e.scale, MIN_S, MAX_S) / view.s, e.clientX, e.clientY);
};
stage.addEventListener('gesturestart', onGesture('start'));
stage.addEventListener('gesturechange', onGesture('change'));

// ======================================================================
// キーボード
// ======================================================================

function isTyping(target: EventTarget | null): boolean {
  if (confirmDlg.open) return true;
  return target instanceof Element && !!target.closest('textarea, input, dialog');
}

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;
  const onButton = e.target instanceof HTMLButtonElement;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  if (e.code === 'Space' && !onButton) {
    e.preventDefault();
    if (!spaceDown) {
      spaceDown = true;
      stage.classList.add('space');
    }
  } else if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo();
    else doUndo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    doRedo();
  } else if (mod && key === 'a') {
    e.preventDefault();
    selectAll();
  } else if (mod && key === 'd') {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected.size) {
      e.preventDefault();
      deleteSelected();
    }
  } else if (e.key === 'Escape') {
    closeMenu();
    if (selected.size) select([]);
  } else if (e.key === 'Enter' && !onButton && selected.size === 1) {
    e.preventDefault();
    editSelected();
  }
});

const releaseSpace = () => {
  spaceDown = false;
  stage.classList.remove('space');
};
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') releaseSpace();
});
window.addEventListener('blur', releaseSpace);

// ======================================================================
// ツールバー
// ======================================================================

undoBtn.addEventListener('click', doUndo);
redoBtn.addEventListener('click', doRedo);
clearBtn.addEventListener('click', askDeleteAll);
byId('zoom-in').addEventListener('click', () =>
  tweenTo(zoomTarget(1.25, window.innerWidth / 2, window.innerHeight / 2)),
);
byId('zoom-out').addEventListener('click', () =>
  tweenTo(zoomTarget(0.8, window.innerWidth / 2, window.innerHeight / 2)),
);
zoomLabel.addEventListener('click', () =>
  tweenTo(zoomTarget(1 / view.s, window.innerWidth / 2, window.innerHeight / 2)),
);
byId('fit').addEventListener('click', fitAll);

window.addEventListener('resize', positionEditor);
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

// ======================================================================
// 起動
// ======================================================================

load();
if (!meta.hasSavedView) {
  view.x = window.innerWidth / 2;
  view.y = window.innerHeight / 2;
  view.s = 1;
}
syncAll();
applyView();
syncUi();
