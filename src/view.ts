// 表示（パン・ズーム・ドット背景）

import { saveSoon, tiles, type View, view } from './state';
import { GRID, MAX_S, MIN_S } from './config';
import { stage, world, zoomLabel } from './dom';
import { bounds } from './tiles';
import { clamp } from './util';

const viewListeners: Array<() => void> = [];

/** 表示（パン・ズーム）が変わったときに呼ぶ関数を登録する */
export function onViewChange(fn: () => void): void {
  viewListeners.push(fn);
}

export function applyView(): void {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  world.style.setProperty('--inv', String(1 / view.s));

  // ドットは画面上で細かすぎず粗すぎない間隔になるよう 2 倍/半分に切り替える
  let gap = GRID * view.s;
  while (gap < 14) gap *= 2;
  while (gap > 56) gap /= 2;
  stage.style.setProperty('--gap', `${gap}px`);
  stage.style.setProperty('--ox', `${view.x - gap / 2}px`);
  stage.style.setProperty('--oy', `${view.y - gap / 2}px`);
  stage.style.setProperty('--dot-r', `${clamp(view.s * 1.1, 0.9, 1.7)}px`);

  zoomLabel.textContent = `${Math.round(view.s * 100)}%`;
  for (const fn of viewListeners) fn();
  saveSoon();
}

export function zoomTarget(factor: number, cx: number, cy: number): View {
  const s = clamp(view.s * factor, MIN_S, MAX_S);
  const k = s / view.s;
  return { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, s };
}

export function zoomAt(factor: number, cx: number, cy: number): void {
  Object.assign(view, zoomTarget(factor, cx, cy));
  applyView();
}

let tweenId = 0;

export const cancelTween = () => void tweenId++;

export function tweenTo(target: View, ms = 260): void {
  const id = ++tweenId;
  const from = { ...view };
  const t0 = performance.now();
  const step = (now: number) => {
    if (id !== tweenId) return;
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    view.x = from.x + (target.x - from.x) * e;
    view.y = from.y + (target.y - from.y) * e;
    view.s = from.s + (target.s - from.s) * e;
    applyView();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const screenToWorld = (px: number, py: number) => ({
  x: (px - view.x) / view.s,
  y: (py - view.y) / view.s,
});

export function fitAll(): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!tiles.size) {
    tweenTo({ x: W / 2, y: H / 2, s: 1 });
    return;
  }
  const b = bounds([...tiles.values()]);
  const s = clamp(Math.min((W - 120) / Math.max(b.w, 1), (H - 160) / Math.max(b.h, 1)), MIN_S, 2);
  tweenTo({
    x: W / 2 - (b.x + b.w / 2) * s,
    y: H / 2 - (b.y + b.h / 2) * s,
    s,
  });
}
