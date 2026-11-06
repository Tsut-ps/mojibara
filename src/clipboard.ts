// コピー・切り取り・貼り付け（Ctrl/⌘+C / X / V）。
// ブラウザの copy / cut / paste イベントを使うので、許可の確認は出ない。
// 配置ごとコピーし、ほかのアプリの文字列を貼ると一文字ずつの文字になる。

import { readingRows, type Box } from './arrange';
import { newId, sanitizeTile, view, tiles, pushUndo, type Tile } from './state';
import { BASE_SIZE, GAP, MAX_TEXT, MAX_TILES, MID_Y, OFFSET, PAD_X, TILE_H } from './config';
import { stage } from './dom';
import { showToast } from './toast';
import { addTiles, changed, deleteSelected, layoutText, select, selectedTiles, worldRect } from './tiles';
import { clamp, graphemes, measure } from './util';
import { screenToWorld } from './view';

const MIME = 'application/x-mojibara-tiles';

type Clip = Array<Pick<Tile, 'ch' | 'x' | 'y' | 'size' | 'color' | 'z'>>;

// 別のブラウザで独自の形式が落とされても貼れるよう、直前のコピーを覚えておく
let last: { text: string; clip: Clip } | null = null;

// 貼り付ける場所：マウスの位置。タッチなど位置がないときは画面の中央
let pointer: { x: number; y: number } | null = null;

stage.addEventListener('pointermove', (e) => {
  pointer = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY };
});

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('textarea, input, dialog');
}

/** 読む順の文字列（行は改行、すき間が大きければ空白） */
function readingText(list: Tile[]): string {
  const boxes: Box[] = list.map((t) => ({ id: t.id, ...worldRect(t), size: t.size }));
  const byId = new Map(list.map((t) => [t.id, t]));
  return readingRows(boxes)
    .map((row) =>
      row
        .map((b, i) => {
          const ch = byId.get(b.id)?.ch ?? '';
          const prev = row[i - 1];
          return prev && b.x - (prev.x + prev.w) > b.size * 0.35 ? ` ${ch}` : ch;
        })
        .join(''),
    )
    .join('\n');
}

function copyTo(e: ClipboardEvent): boolean {
  const list = selectedTiles();
  if (!list.length || !e.clipboardData) return false;
  const ordered = [...list].sort((a, b) => a.z - b.z);
  const clip: Clip = ordered.map(({ ch, x, y, size, color, z }) => ({ ch, x, y, size, color, z }));
  const text = readingText(list);
  e.clipboardData.setData('text/plain', text);
  e.clipboardData.setData(MIME, JSON.stringify({ v: 1, tiles: clip }));
  last = { text, clip };
  e.preventDefault();
  return true;
}

function parseClip(raw: string): Clip | null {
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.tiles)) return null;
    const out: Clip = [];
    for (const r of d.tiles.slice(0, MAX_TILES)) {
      const t = sanitizeTile({ ...r, id: 'x' });
      if (t) out.push({ ch: t.ch, x: t.x, y: t.y, size: t.size, color: t.color, z: t.z });
    }
    return out;
  } catch {
    return null;
  }
}

/** 貼り付ける位置（ワールド座標）の中心 */
function target(): { x: number; y: number } {
  return screenToWorld(pointer?.x ?? window.innerWidth / 2, pointer?.y ?? window.innerHeight / 2);
}

function pasteClip(clip: Clip): void {
  if (!clip.length) return;
  // 元の範囲の中心を、貼り付け先の中心に合わせる（文字の幅は計測で見積もる）
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const c of clip) {
    x1 = Math.min(x1, c.x);
    y1 = Math.min(y1, c.y);
    x2 = Math.max(x2, c.x + measure(c.ch, c.size) + c.size * GAP);
    y2 = Math.max(y2, c.y + c.size * TILE_H);
  }
  const p = target();
  let dx = p.x - (x1 + x2) / 2;
  let dy = p.y - (y1 + y2) / 2;
  // すでに同じ場所に同じ文字があれば、少しずらして重ねて貼る
  const probe = clip.slice(0, 50);
  const taken = (ox: number, oy: number) =>
    probe.some((c) =>
      [...tiles.values()].some(
        (t) => t.ch === c.ch && Math.abs(t.x - (c.x + ox)) < 1 && Math.abs(t.y - (c.y + oy)) < 1,
      ),
    );
  for (let i = 0; i < 20 && taken(dx, dy); i++) {
    dx += OFFSET;
    dy += OFFSET;
  }
  const ordered = [...clip].sort((a, b) => a.z - b.z);
  pushUndo();
  const created = addTiles(
    ordered.map((c) => ({
      tile: { id: newId(), ch: c.ch, x: c.x + dx, y: c.y + dy, size: c.size, color: c.color, z: 0 },
      cx: c.x + dx,
    })),
  );
  select(created.map((t) => t.id));
  changed();
}

function pasteText(raw: string): void {
  let text = raw;
  const g = graphemes(text);
  if (g.length > MAX_TEXT) {
    text = g.slice(0, MAX_TEXT).join('');
    showToast(`長いので、先頭の ${MAX_TEXT} 文字だけ貼り付けました`);
  }
  // 入力したときと同じ大きさ（画面上で 16〜72px）で、マウスの位置から並べる
  const size = Math.round(clamp(BASE_SIZE, 16 / view.s, 72 / view.s));
  const p = target();
  const laid = layoutText(text, p.x - PAD_X * size, p.y - MID_Y * size, size, 'ink');
  if (!laid.length) return;
  pushUndo();
  const created = addTiles(laid);
  select(created.map((t) => t.id));
  changed();
}

document.addEventListener('copy', (e) => {
  if (isTypingTarget(e.target)) return;
  copyTo(e);
});

document.addEventListener('cut', (e) => {
  if (isTypingTarget(e.target)) return;
  if (copyTo(e)) deleteSelected();
});

document.addEventListener('paste', (e) => {
  if (isTypingTarget(e.target) || !e.clipboardData) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  const raw = e.clipboardData.getData(MIME);
  const clip = raw ? parseClip(raw) : last && last.text === text ? last.clip : null;
  if (clip?.length) pasteClip(clip);
  else if (text.trim()) pasteText(text);
});
