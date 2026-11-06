// 効果音（積み木が「コツッ」とはまる音）。音声ファイルは使わず、Web Audio で合成する。

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

/**
 * 木の積み木がはまる音を t 秒の時点から鳴らす。
 * ① ごく短いノイズ（当たりのコツッ）② 木の胴鳴り（低めの音が素早く減衰）
 * pitch は 1 前後の値で、毎回少し変えると自然に聞こえる。
 */
export function synthSnap(c: BaseAudioContext, dest: AudioNode, t: number, pitch = 1): void {
  const out = c.createGain();
  out.gain.value = 0.65;
  out.connect(dest);

  const hit = c.createBufferSource();
  hit.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400 * pitch;
  band.Q.value = 0.9;
  const hitGain = c.createGain();
  hitGain.gain.setValueAtTime(0.0001, t);
  hitGain.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  hit.connect(band).connect(hitGain).connect(out);
  hit.start(t);
  hit.stop(t + 0.05);

  const body = (freq: number, peak: number, dur: number) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.82, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  body(560 * pitch, 0.32, 0.09);
  body(1380 * pitch, 0.12, 0.045);
}

/** スナップ音。連続して鳴りすぎないよう間隔をあける */
export function playSnap(): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - lastAt < 70) return;
  lastAt = now;
  synthSnap(ctx, ctx.destination, ctx.currentTime, 1 + (Math.random() - 0.5) * 0.12);
}
