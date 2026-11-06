// 画面移動（中ボタン・Space・タッチの背景ドラッグ）

import { view } from '../state';
import { DRAG_PX } from '../config';
import { stage } from '../dom';
import { applyView } from '../view';
import { type Gesture, cancelLongPress, tap } from './shared';
import { selected, select } from '../tiles';

/**
 * immediate: 押した瞬間から動かす（中ボタン・Space）。
 * そうでなければ、動かさずに離すと背景のタップ（選択解除 / 入力欄）になる。
 */
export function startPan(e: PointerEvent, immediate: boolean): Gesture {
  const startX = e.clientX;
  const startY = e.clientY;
  const vx = view.x;
  const vy = view.y;
  let moved = immediate;
  if (immediate) stage.classList.add('panning');

  return {
    get longPressable() {
      return !moved;
    },
    move(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        moved = true;
        cancelLongPress();
        stage.classList.add('panning');
      }
      view.x = vx + dx;
      view.y = vy + dy;
      applyView();
    },
    end(_e, ok) {
      if (!immediate && !moved && ok) {
        if (selected.size) select([]);
        else tap.pending = true;
      }
    },
    abort() {},
  };
}
