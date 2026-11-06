// ピンチ（2 本指）でズーム

import { view } from '../../core/state';
import { MAX_S, MIN_S } from '../../core/config';
import { clamp } from '../../core/util';
import { applyView, screenToWorld } from '../../core/view';
import { type Gesture, pointers } from './shared';

export function startPinch(): Gesture {
  const [a, b] = [...pointers.values()];
  const sx = (a.x + b.x) / 2;
  const sy = (a.y + b.y) / 2;
  const w = screenToWorld(sx, sy);
  const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const s0 = view.s;

  return {
    longPressable: false,
    multi: true,
    move() {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const s = clamp(s0 * (Math.hypot(a.x - b.x, a.y - b.y) / dist), MIN_S, MAX_S);
      view.s = s;
      view.x = cx - w.x * s;
      view.y = cy - w.y * s;
      applyView();
    },
    end() {},
    abort() {},
  };
}
