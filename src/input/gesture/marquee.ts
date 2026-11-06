// 範囲選択（マウス・ペンの背景ドラッグ）

import { DRAG_PX } from '../../core/config';
import { marquee } from '../../core/dom';
import { type Gesture, tap } from './shared';
import { els, select, selected } from '../../tiles/tiles';

/** additive: Shift・Ctrl/⌘ で今の選択に追加する */
export function startMarquee(e: PointerEvent, additive: boolean): Gesture {
  const startX = e.clientX;
  const startY = e.clientY;
  const base = new Set(additive ? selected : []);
  let moved = false;

  return {
    longPressable: false,
    move(e) {
      if (!moved) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_PX) return;
        moved = true;
      }
      const x1 = Math.min(startX, e.clientX);
      const y1 = Math.min(startY, e.clientY);
      const x2 = Math.max(startX, e.clientX);
      const y2 = Math.max(startY, e.clientY);
      marquee.hidden = false;
      Object.assign(marquee.style, {
        left: `${x1}px`,
        top: `${y1}px`,
        width: `${x2 - x1}px`,
        height: `${y2 - y1}px`,
      });
      const hits = new Set(base);
      for (const [id, el] of els) {
        const r = el.getBoundingClientRect();
        if (r.right >= x1 && r.left <= x2 && r.bottom >= y1 && r.top <= y2) hits.add(id);
      }
      select(hits);
    },
    end(_e, ok) {
      marquee.hidden = true;
      // 動かさずに離した＝背景のクリック。選択があれば解除だけ、なければ入力欄を開く（Shift などの追加操作中は何もしない）
      if (!moved && ok && !additive) {
        if (selected.size) select([]);
        else tap.pending = true;
      }
    },
    abort() {},
  };
}
