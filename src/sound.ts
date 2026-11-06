// 効果音（積み木が「カ・ト・チッ」とはまる音）。音声ファイルは使わず、Web Audio で合成する。

const STORAGE_KEY = 'mojibara:sound';

let enabled = true;
try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
} catch {
  /* 保存できない環境ではオンのまま */
}

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
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

/** 白色ノイズ（打撃の当たり・息のような音に使う） */
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== c.sampleRate) {
    const len = Math.floor(c.sampleRate * 0.5);
    noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** 立ち上がりが速く、指数的に消える音量の形 */
function envelope(g: GainNode, t: number, peak: number, dur: number, attack: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// ---- 音の部品 ----

/** 帯域ノイズの短い当たり */
function knock(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak: number, dur: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = hz;
  band.Q.value = 0.8;
  const g = c.createGain();
  envelope(g, at, peak, dur, 0.001);
  src.connect(band).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** 音程が from → to へ動くサイン波 */
function tone(
  c: BaseAudioContext,
  out: AudioNode,
  at: number,
  from: number,
  to: number,
  peak: number,
  dur: number,
  attack = 0.002,
): void {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  envelope(g, at, peak, dur, attack);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** ノイズを帯域フィルタで from → to へ掃引する（「ふっ」「ざあっ」） */
function swish(
  c: BaseAudioContext,
  out: AudioNode,
  at: number,
  from: number,
  to: number,
  dur: number,
  peak: number,
  attack = dur * 0.25,
): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.7;
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  envelope(g, at, peak, dur, attack);
  src.connect(band).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** 低い着地音：音程が落ちる胴鳴り ＋ 当たり */
function thud(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak = 0.42): void {
  tone(c, out, at, hz * 2.4, hz, peak, 0.07);
  knock(c, out, at, 1100, peak * 0.6, 0.012);
}

// 音の高さ（Hz）
const C3 = 130.81;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392;
const A4 = 440;

/**
 * 積み木がはまる音を t 秒の時点から鳴らす。三拍が約 25 ミリ秒でつながる。
 * 「か」＝帯域ノイズの当たり、「と」＝低い胴鳴り（音程が落ちる）、
 * 「ち」＝最後の小さな留め金。「と」はド4に着地し、「ち」はその 2 オクターブ上のド6。
 * 毎回同じ音にする（ゆらぎなし）。
 */
export function synthSnap(c: BaseAudioContext, dest: AudioNode, t: number): void {
  const out = c.createGain();
  out.gain.value = 0.64; // 以前の 65%
  out.connect(dest);

  knock(c, out, t, 2200, 0.35, 0.01); // か
  tone(c, out, t + 0.003, 900, C4, 0.38, 0.045); // と：ド4（261.6Hz）に着地
  const u = t + 0.024;
  knock(c, out, u, 1960, 0.22, 0.007); // ち：ド6（1046.5Hz）
  tone(c, out, u, 1046.5, 1046.5, 0.14, 0.018, 0.001);
}

// ---- 操作の効果音（スナップ音と同じ積み木の仲間。ド周辺で、高い音は避ける）----

export type Sfx = 'place' | 'paste' | 'duplicate' | 'delete' | 'clear' | 'undo' | 'redo' | 'arrange' | 'scatter';

// trim：種類ごとの音量のそろえ（ノイズ系は小さく聞こえるので大きめ）
const SFX: Record<Sfx, { trim: number; play: (c: BaseAudioContext, out: AudioNode, t: number) => void }> = {
  // コトッ：低い着地
  place: {
    trim: 1,
    play(c, o, t) {
      thud(c, o, t, C4);
      tone(c, o, t + 0.004, C3, C3, 0.2, 0.13);
    },
  },
  // ぱさっ：ふわっと着地
  paste: {
    trim: 1.4,
    play(c, o, t) {
      swish(c, o, t, 3000, 800, 0.09, 0.3);
      thud(c, o, t + 0.055, C4, 0.3);
    },
  },
  // ぴょこ：ド→ソへ跳ねる
  duplicate: {
    trim: 1,
    play(c, o, t) {
      tone(c, o, t, C4, G4, 0.36, 0.085, 0.004);
      mallet(c, o, t + 0.085, G4, 0.22, 0.1);
    },
  },
  // ふっ：息のような音
  delete: {
    trim: 2.4,
    play(c, o, t) {
      swish(c, o, t, 2500, 500, 0.13, 0.34);
    },
  },
  // ざあっ：崩れる
  clear: {
    trim: 0.9,
    play(c, o, t) {
      swish(c, o, t, 4000, 300, 0.36, 0.36, 0.03);
      thud(c, o, t, C3, 0.5);
    },
  },
  // くるっ：ソ→ド（戻す）/ ド→ソ（やり直す）
  undo: {
    trim: 1,
    play(c, o, t) {
      tone(c, o, t, G4, C4, 0.4, 0.085, 0.003);
    },
  },
  redo: {
    trim: 1,
    play(c, o, t) {
      tone(c, o, t, C4, G4, 0.4, 0.085, 0.003);
    },
  },
  // カタタタ：ド・レ・ミ・ソ・ラとそろう
  arrange: {
    trim: 1,
    play(c, o, t) {
      [C4, D4, E4, G4, A4].forEach((f, i) => mallet(c, o, t + i * 0.035, f, 0.27, 0.07));
    },
  },
  // ばさっ：まく
  scatter: {
    trim: 1.3,
    play(c, o, t) {
      swish(c, o, t, 800, 3500, 0.12, 0.34);
      [C4, 196, E4].forEach((f, i) => thud(c, o, t + 0.09 + i * 0.05, f, 0.3));
    },
  },
};

/** 木のマレット：基音 ＋ 4 倍音（すぐ消える）＋ 小さな当たり */
function mallet(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak: number, dur: number): void {
  tone(c, out, at, hz, hz, peak, dur);
  tone(c, out, at, hz * 4, hz * 4, peak * 0.16, dur * 0.3, 0.001);
  knock(c, out, at, 1800, peak * 0.45, 0.006);
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
