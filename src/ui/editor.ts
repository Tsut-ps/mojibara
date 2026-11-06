// 入力欄（新規入力 / 一文字編集）

import { pushUndo, tiles, view } from '../core/state';
import { BASE_SIZE, MID_Y, PAD_X, PAD_Y } from '../core/config';
import { editor } from '../core/dom';
import {
  addTiles,
  changed,
  els,
  ensureEl,
  layoutText,
  notify,
  paintTile,
  removeTile,
  select,
  selected,
} from '../tiles/tiles';
import { playSfx } from '../sound';
import { clamp, ensureFont, measure } from '../core/util';
import { onViewChange, screenToWorld } from '../core/view';

interface EditCtx {
  mode: 'new' | 'edit';
  id?: string;
  x: number; // ワールド座標。タイル左上に相当
  y: number;
  size: number;
  color: string;
}

export function isEditing(): boolean {
  return edit !== null;
}

let edit: EditCtx | null = null;

export function openNew(clientX: number, clientY: number): void {
  const p = screenToWorld(clientX, clientY);
  // 画面上で 16〜72px に収まるよう、拡大率に応じて大きさを決める
  const size = Math.round(clamp(BASE_SIZE, 16 / view.s, 72 / view.s));
  openEditor({
    mode: 'new',
    x: p.x - PAD_X * size,
    y: p.y - MID_Y * size, // ポインタ位置が 1 行目の中央になるように
    size,
    color: 'ink',
  });
}

export function openEdit(id: string): void {
  const t = tiles.get(id);
  if (!t) return;
  els.get(id)?.classList.add('editing');
  openEditor({ mode: 'edit', id, x: t.x, y: t.y, size: t.size, color: t.color }, t.ch);
}

function openEditor(ctx: EditCtx, initial = ''): void {
  edit = ctx;
  editor.value = initial;
  editor.style.color = `var(--c-${ctx.color})`;
  editor.hidden = false;
  document.body.classList.add('editing');
  notify();
  positionEditor();
  editor.focus();
  editor.select();
  void ensureFont(initial).then(fitEditor);
}

export function positionEditor(): void {
  if (!edit) return;
  const fs = edit.size * view.s;
  editor.style.fontSize = `${fs}px`;
  editor.style.left = `${view.x + edit.x * view.s}px`;
  // 入力欄の行(1.45em)の中央とタイルの文字の中央を揃える
  editor.style.top = `${view.y + (edit.y - PAD_Y * edit.size) * view.s}px`;
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
  notify();
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
    playSfx('place');
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

export function editSelected(): void {
  if (selected.size !== 1) return;
  const [id] = selected;
  setTimeout(() => openEdit(id), 0);
}

onViewChange(positionEditor);
