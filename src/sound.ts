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

/** 短い白色ノイズ（打撃の当たりに使う） */
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== c.sampleRate) {
    const len = Math.floor(c.sampleRate * 0.05);
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

/**
 * 積み木がはまる音を t 秒の時点から鳴らす。三拍が約 25 ミリ秒でつながる。
 * 「か」＝帯域ノイズの当たり、「と」＝低い胴鳴り（音程が落ちる）、
 * 「ち」＝最後の小さな留め金。毎回同じ音にする（ゆらぎなし）。
 */
export function synthSnap(c: BaseAudioContext, dest: AudioNode, t: number): void {
  const out = c.createGain();
  out.gain.value = 0.99;
  out.connect(dest);

  const knock = (at: number, hz: number, peak: number, dur: number) => {
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
  };
  const tone = (at: number, from: number, to: number, peak: number, dur: number, attack: number) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = c.createGain();
    envelope(g, at, peak, dur, attack);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  knock(t, 2200, 0.35, 0.01); // か
  tone(t + 0.003, 900, 260, 0.38, 0.045, 0.002); // と
  const u = t + 0.024;
  knock(u, 2800, 0.22, 0.007); // ち
  tone(u, 1700, 1700, 0.14, 0.018, 0.001);
}

/** スナップ音。吸着の出入りが細かく続いても 1 回に聞こえるよう、間隔をあける */
export function playSnap(): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - lastAt < SNAP_GAP_MS) return;
  lastAt = now;
  synthSnap(ctx, ctx.destination, ctx.currentTime);
}
