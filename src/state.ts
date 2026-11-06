// データ・履歴・ブラウザ保存（DOM には触れない）

export interface Tile {
  id: string;
  ch: string; // 一文字（絵文字などは1書記素）
  x: number; // ワールド座標（左上）
  y: number;
  size: number; // フォントサイズ（ワールド単位）
  color: string; // COLORS の key
  z: number;
}

export interface View {
  x: number;
  y: number;
  s: number;
}

export const COLORS = [
  { key: 'ink', label: '黒' },
  { key: 'red', label: '赤' },
  { key: 'orange', label: '橙' },
  { key: 'green', label: '緑' },
  { key: 'blue', label: '青' },
  { key: 'purple', label: '紫' },
  { key: 'pink', label: '桃' },
  { key: 'gray', label: '灰' },
] as const;

const COLOR_KEYS: string[] = COLORS.map((c) => c.key);
const STORAGE_KEY = 'mojibara:v1';

export const tiles = new Map<string, Tile>();
export const view: View = { x: 0, y: 0, s: 1 };
export const meta = { hasSavedView: false, zTop: 0 };

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitize(raw: unknown): Tile | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.ch !== 'string' || !t.ch) return null;
  if (!isNum(t.x) || !isNum(t.y) || !isNum(t.size) || t.size <= 0) return null;
  return {
    id: t.id,
    ch: t.ch,
    x: t.x,
    y: t.y,
    size: t.size,
    color: typeof t.color === 'string' && COLOR_KEYS.includes(t.color) ? t.color : 'ink',
    z: isNum(t.z) ? t.z : 0,
  };
}

function recomputeZ(): void {
  meta.zTop = 0;
  for (const t of tiles.values()) meta.zTop = Math.max(meta.zTop, t.z);
}

// ---- 保存 / 読み込み ----

export function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.tiles)) {
      for (const r of d.tiles) {
        const t = sanitize(r);
        if (t) tiles.set(t.id, t);
      }
    }
    const v = d.view;
    if (v && isNum(v.x) && isNum(v.y) && isNum(v.s) && v.s > 0) {
      view.x = v.x;
      view.y = v.y;
      view.s = v.s;
      meta.hasSavedView = true;
    }
  } catch {
    /* 壊れたデータや保存不可の環境は無視して空で始める */
  }
  recomputeZ();
}

function save(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, tiles: [...tiles.values()], view }),
    );
  } catch {
    /* 容量超過・無効化など */
  }
}

let saveTimer = 0;
let dirty = false;

export function saveSoon(): void {
  dirty = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 300);
}

export function flushSave(): void {
  window.clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  save();
}

// ---- 元に戻す / やり直し（スナップショット方式）----

const MAX_HISTORY = 200;
const undoStack: string[] = [];
const redoStack: string[] = [];

const snapshot = () => JSON.stringify([...tiles.values()]);

function restore(json: string): void {
  tiles.clear();
  for (const r of JSON.parse(json)) {
    const t = sanitize(r);
    if (t) tiles.set(t.id, t);
  }
  recomputeZ();
}

/** 変更の直前に呼ぶ */
export function pushUndo(): void {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

export function undo(): boolean {
  const s = undoStack.pop();
  if (s === undefined) return false;
  redoStack.push(snapshot());
  restore(s);
  return true;
}

export function redo(): boolean {
  const s = redoStack.pop();
  if (s === undefined) return false;
  undoStack.push(snapshot());
  restore(s);
  return true;
}

export const canUndo = () => undoStack.length > 0;

/** 履歴の深さ。操作つきの通知が古くなったか調べるのに使う */
export const undoDepth = () => undoStack.length;
export const canRedo = () => redoStack.length > 0;
