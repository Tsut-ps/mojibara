// ポインタ操作（移動・選択・パン・ピンチ・ダブルクリック・長押し・ホイール）

import { pushUndo, tiles, view } from './state';
import { DRAG_PX, LIFT_MAX, MAX_S, MIN_S, SNAP_PX } from './config';
import { marquee, stage } from './dom';
import { openEdit, openNew } from './editor';
import { closeMenu } from './menu';
import { showBgMenu, showTileMenu } from './menus';
import { findSnap, type Rect, type Snap, type Target } from './snap';
import { playSnap, unlockAudio } from './sound';
import {
  bounds,
  bringToFront,
  changed,
  connectedOf,
  els,
  refreshSelection,
  select,
  selected,
  selectedTiles,
  worldRect,
} from './tiles';
import { clamp } from './util';
import { applyView, cancelTween, screenToWorld, zoomAt } from './view';

function openContextAt(x: number, y: number, tileEl: Element | null): void {
  cancelLongPress();
  endDrag(drag);
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

type Drag =
  | {
      kind: 'tiles';
      id: string;
      startX: number;
      startY: number;
      moved: boolean;
      additive: boolean; // Shift・Ctrl/⌘：クリックは 1 つずつ追加 / 外す、ドラッグはつながった文字ごと動かす
      wasSelected: boolean;
      orig: Map<string, { x: number; y: number }>;
      // 横スナップ用（動かし始めた時点で確定する）
      group: Rect | null; // 動かしている文字の範囲
      others: Target[]; // 吸着先の候補（動かさない文字）
      moving: HTMLElement[];
      snap: Snap | null; // 今の吸着状態
      evaluated: boolean; // 吸着の判定を一度でも行ったか（最初の判定は音を鳴らさない）
      glideTimer: number;
    }
  | { kind: 'pan'; startX: number; startY: number; vx: number; vy: number; moved: boolean; bgTap: boolean }
  | { kind: 'marquee'; startX: number; startY: number; base: Set<string>; moved: boolean; additive: boolean }
  | { kind: 'pinch'; dist: number; sx: number; sy: number; s: number; wx: number; wy: number };

type TilesDrag = Extract<Drag, { kind: 'tiles' }>;

const pointers = new Map<number, { x: number; y: number }>();

let drag: Drag | null = null;

let spaceDown = false;

let tapPending = false; // 選択のない背景をタップした → click で入力欄を開く（iOS でキーボードを出すため）

let lastTap: { id: string; t: number; x: number; y: number } | null = null;

let lpTimer = 0;

function cancelLongPress(): void {
  window.clearTimeout(lpTimer);
}

/**
 * 吸着先が変わった：ぬるっと動かし、吸着していない状態から吸着したときだけカチッと鳴らす。
 * silent は、持ち上げた時点ですでに隣にくっついていた場合（持ち上げただけで鳴らさない）。
 */
function setSnap(d: TilesDrag, next: Snap | null, silent = false): void {
  const engaging = !d.snap && next !== null; // 吸着先どうしの乗り換えでは鳴らさない
  if (d.snap) els.get(d.snap.id)?.classList.remove('snap-target');
  d.snap = next;
  for (const el of d.moving) el.classList.add('glide');
  window.clearTimeout(d.glideTimer);
  d.glideTimer = window.setTimeout(() => {
    for (const el of d.moving) el.classList.remove('glide');
  }, 160);
  if (next) els.get(next.id)?.classList.add('snap-target');
  if (engaging && !silent) playSnap();
}

/** ドラッグが終わる・中断したとき、持ち上げ表示と吸着先の表示を消す */
function endDrag(d: Drag | null): void {
  if (d?.kind !== 'tiles') return;
  for (const el of d.moving) el.classList.remove('lifted');
  if (d.snap) {
    els.get(d.snap.id)?.classList.remove('snap-target');
    d.snap = null;
  }
}

export function setSpace(on: boolean): void {
  spaceDown = on;
  stage.classList.toggle('space', on);
}

stage.addEventListener('pointerdown', (e) => {
  unlockAudio(); // 音はユーザー操作の中でないと出せない
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

  const modifier = e.shiftKey || e.metaKey || e.ctrlKey; // Shift・Ctrl/⌘ のどちらでも同じ

  if (tileEl instanceof HTMLElement && tileEl.dataset.id) {
    const id = tileEl.dataset.id;
    const wasSelected = selected.has(id);
    if (modifier) {
      if (!wasSelected) {
        selected.add(id);
        refreshSelection();
      }
    } else if (!wasSelected) {
      select([id]);
    }
    const orig = new Map<string, { x: number; y: number }>();
    for (const t of selectedTiles()) orig.set(t.id, { x: t.x, y: t.y });
    drag = {
      kind: 'tiles',
      id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      additive: modifier,
      wasSelected,
      orig,
      group: null,
      others: [],
      moving: [],
      snap: null,
      evaluated: false,
      glideTimer: 0,
    };
    return;
  }

  // マウス・ペン：背景のドラッグは範囲選択（Shift・Ctrl/⌘ で今の選択に追加）。タッチは下の「画面移動」
  if (e.pointerType !== 'touch') {
    const bgAdditive = modifier;
    drag = {
      kind: 'marquee',
      startX: e.clientX,
      startY: e.clientY,
      base: new Set(bgAdditive ? selected : []),
      moved: false,
      additive: bgAdditive,
    };
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
      if (d.additive) {
        // Shift・Ctrl/⌘ で動かし始めたら、押した文字につながった文字も選択に加えて、いっしょに動かす
        for (const g of connectedOf([d.id])) {
          selected.add(g);
          const t = tiles.get(g);
          if (t && !d.orig.has(g)) d.orig.set(g, { x: t.x, y: t.y });
        }
        refreshSelection();
      }
      const list = selectedTiles();
      bringToFront(list);
      for (const t of list) els.get(t.id)?.classList.remove('spawn');
      stage.classList.add('dragging');
      // 横スナップの準備：動かす範囲と、動かさない文字の位置を一度だけ測る
      d.group = bounds(list);
      d.others = [...tiles.values()].filter((t) => !d.orig.has(t.id)).map((t) => ({ id: t.id, ...worldRect(t) }));
      d.moving = list.map((t) => els.get(t.id)).filter((el): el is HTMLDivElement => !!el);
      // 掴んだ文字を持ち上げて見せる（大量だと重くなるので少数のときだけ）
      if (d.moving.length <= LIFT_MAX) for (const el of d.moving) el.classList.add('lifted');
    }

    // 横スナップ（Alt を押している間は無効）
    let sx = 0;
    let sy = 0;
    if (d.group) {
      const raw = { x: d.group.x + dx / view.s, y: d.group.y + dy / view.s, w: d.group.w, h: d.group.h };
      const found = e.altKey ? null : findSnap(raw, d.others, SNAP_PX / view.s, d.snap);
      const first = !d.evaluated;
      d.evaluated = true;
      if (found?.id !== d.snap?.id || found?.side !== d.snap?.side) setSnap(d, found, first);
      sx = found?.dx ?? 0;
      sy = found?.dy ?? 0;
    }

    for (const [id, o] of d.orig) {
      const t = tiles.get(id);
      const el = els.get(id);
      if (!t || !el) continue;
      t.x = o.x + dx / view.s + sx;
      t.y = o.y + dy / view.s + sy;
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
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
    }
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
    endDrag(d);
    if (d.moved || !ok) return;
    // ここからは「動かさずに離した」＝タップ
    if (d.additive) {
      // 動かさずに離した：すでに選んでいた文字なら外す（1 つずつ追加・外す）
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
      else tapPending = true;
    }
  } else if (d.kind === 'marquee') {
    marquee.hidden = true;
    // 動かさずに離した＝背景のクリック。選択があれば解除だけ、なければ入力欄を開く（Shift などの追加操作中は何もしない）
    if (!d.moved && ok && !d.additive) {
      if (selected.size) select([]);
      else tapPending = true;
    }
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
  endDrag(drag);
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
