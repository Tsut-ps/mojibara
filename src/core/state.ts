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
const MAX_CH = 32; // 一文字（絵文字の連結を含む）として許す長さ
const MAX_COORD = 1e7;
const MAX_FONT = 2000;
export const MAX_IMPORT = 20000; // ファイルから一度に読み込める文字数

export const tiles = new Map<string, Tile>();
export const view: View = { x: 0, y: 0, s: 1 };
export const meta = { hasSavedView: false, zTop: 0 };

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeTile(raw: unknown): Tile | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.ch !== 'string' || !t.ch || t.ch.length > MAX_CH) return null;
  if (!isNum(t.x) || !isNum(t.y) || !isNum(t.size) || t.size <= 0) return null;
  // 外から来たデータ（ファイル・貼り付け）で、画面が壊れるほど大きな値は受け付けない
  if (Math.abs(t.x) > MAX_COORD || Math.abs(t.y) > MAX_COORD || t.size > MAX_FONT) return null;
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
        const t = sanitizeTile(r);
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

// ---- ファイルへの書き出し / 読み込み ----

/** バックアップ用の JSON（保存データと同じ形に、アプリ名を付ける） */
export function exportJson(): string {
  return JSON.stringify({ app: 'mojibara', v: 1, tiles: [...tiles.values()], view }, null, 1);
}

/** 読み込んだ JSON の文字を取り出す。形式が違う・多すぎるときは null（壊れた文字は読み飛ばす） */
export function parseJson(text: string): Tile[] | null {
  try {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.tiles) || d.tiles.length > MAX_IMPORT) return null;
    const out: Tile[] = [];
    for (const r of d.tiles) {
      const t = sanitizeTile(r);
      if (t) out.push(t);
    }
    return out;
  } catch {
    return null;
  }
}

// ---- 元に戻す / やり直し（スナップショット方式）----

const MAX_HISTORY = 200;
const undoStack: string[] = [];
const redoStack: string[] = [];

const snapshot = () => JSON.stringify([...tiles.values()]);

function restore(json: string): void {
  tiles.clear();
  for (const r of JSON.parse(json)) {
    const t = sanitizeTile(r);
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
