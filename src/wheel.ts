// ホイール / トラックパッドのピンチによるズーム

import { view } from './state';
import { MAX_S, MIN_S } from './config';
import { stage } from './dom';
import { pointers } from './gesture/shared';
import { closeMenu } from './menu';
import { clamp } from './util';
import { cancelTween, zoomAt } from './view';

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
