// 効果音の窓口（オン/オフ・再生）。音声ファイルは使わず、Web Audio で合成する。
// 音のレシピは recipes.ts、素材は parts.ts

import { SFX, type Sfx, synthSnap } from './recipes';

const STORAGE_KEY = 'mojibara:sound';

let enabled = true;
try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
} catch {
  /* 保存できない環境ではオンのまま */
}

let ctx: AudioContext | null = null;
let lastAt = 0;
const SNAP_GAP_MS = 350;

export function isSoundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* 無視 */
  }
  if (on) unlockAudio();
}

/** ブラウザの自動再生制限のため、ユーザー操作の中で呼んで音を出せる状態にする */
export function unlockAudio(): void {
  if (!enabled) return;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* 音が出せないだけなので無視 */
  }
}

const SFX_GAP_MS = 60; // キーを押しっぱなしにしても音が団子にならないように
const sfxAt: Partial<Record<Sfx, number>> = {};

/** 操作の効果音。ミュート中・音が出せない状態では何もしない */
export function playSfx(name: Sfx): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - (sfxAt[name] ?? -Infinity) < SFX_GAP_MS) return;
  sfxAt[name] = now;
  const { trim, play } = SFX[name];
  const out = ctx.createGain();
  out.gain.value = 0.64 * trim;
  out.connect(ctx.destination);
  play(ctx, out, ctx.currentTime);
}

/** スナップ音。吸着の出入りが細かく続いても 1 回に聞こえるよう、間隔をあける */
export function playSnap(): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - lastAt < SNAP_GAP_MS) return;
  lastAt = now;
  synthSnap(ctx, ctx.destination, ctx.currentTime);
}

// ボタンやキー操作（ステージ以外）の最初の操作でも音を出せるようにする
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, unlockAudio, true);
