// ポインタ操作の振り分け（押した場所・ボタンに応じて gesture/ のどれかを始める）

import { stage } from '../core/dom';
import { type Gesture, cancelLongPress, pointers, startLongPress, tap } from './gesture/shared';
import { startMarquee } from './gesture/marquee';
import { startPan } from './gesture/pan';
import { startPinch } from './gesture/pinch';
import { startTilesDrag } from './gesture/tiles';
import { openNew } from '../ui/editor';
import { showBgMenu, showTileMenu } from '../ui/menus';
import { select, selected } from '../tiles/tiles';
import { unlockAudio } from '../sound';
import { cancelTween } from '../core/view';

let drag: Gesture | null = null;

let spaceDown = false;

export function setSpace(on: boolean): void {
  spaceDown = on;
  stage.classList.toggle('space', on);
}

function openContextAt(x: number, y: number, tileEl: Element | null): void {
  cancelLongPress();
  drag?.abort();
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

stage.addEventListener('pointerdown', (e) => {
  unlockAudio(); // 音はユーザー操作の中でないと出せない
  cancelTween();
  tap.pending = false;
  if (e.button === 2) return; // 右クリックは contextmenu で処理

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.setPointerCapture(e.pointerId);

  if (pointers.size === 2) {
    cancelLongPress();
    drag?.abort();
    stage.classList.remove('dragging', 'panning');
    drag = startPinch();
    return;
  }
  if (pointers.size > 2) return;

  const tileEl = (e.target as Element).closest('.tile');

  // 長押し → メニュー（iOS など contextmenu が出ない環境向け）
  if (e.pointerType !== 'mouse') {
    const { clientX, clientY } = e;
    startLongPress(() => {
      if (drag?.longPressable && pointers.size === 1) openContextAt(clientX, clientY, tileEl);
    });
  }

  // 中ボタン / Space 押下中 → パン
  if (e.button === 1 || spaceDown) {
    e.preventDefault();
    drag = startPan(e, true);
    return;
  }

  const modifier = e.shiftKey || e.metaKey || e.ctrlKey; // Shift・Ctrl/⌘ のどちらでも同じ

  if (tileEl instanceof HTMLElement && tileEl.dataset.id) {
    drag = startTilesDrag(e, tileEl.dataset.id, modifier);
  } else if (e.pointerType !== 'touch') {
    // マウス・ペン：背景のドラッグは範囲選択（Shift・Ctrl/⌘ で今の選択に追加）。タッチは「画面移動」
    drag = startMarquee(e, modifier);
  } else {
    drag = startPan(e, false);
  }
});

stage.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  drag?.move(e);
});

function onPointerEnd(e: PointerEvent): void {
  if (!pointers.delete(e.pointerId)) return;
  cancelLongPress();
  const g = drag;
  if (!g) return;
  if (g.multi) {
    if (pointers.size < 2) drag = null;
    return;
  }
  drag = null;
  stage.classList.remove('dragging', 'panning');
  g.end(e, e.type === 'pointerup');
}

stage.addEventListener('pointerup', onPointerEnd);

stage.addEventListener('pointercancel', onPointerEnd);

stage.addEventListener('click', (e) => {
  if (!tap.pending) return;
  tap.pending = false;
  openNew(e.clientX, e.clientY);
});

stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  openContextAt(e.clientX, e.clientY, (e.target as Element).closest('.tile'));
});
