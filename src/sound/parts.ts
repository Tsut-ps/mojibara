// 効果音の部品（Web Audio の音の素材。音のレシピは recipes.ts）

let noise: AudioBuffer | null = null;

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
export function envelope(g: GainNode, t: number, peak: number, dur: number, attack: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** 帯域ノイズの短い当たり */
export function knock(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak: number, dur: number): void {
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
export function tone(
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
export function swish(
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
export function thud(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak = 0.42): void {
  tone(c, out, at, hz * 2.4, hz, peak, 0.07);
  knock(c, out, at, 1100, peak * 0.6, 0.012);
}

// 音の高さ（Hz）
export const C3 = 130.81;
export const C4 = 261.63;
export const D4 = 293.66;
export const E4 = 329.63;
export const G4 = 392;
export const A4 = 440;

/** 木のマレット：基音 ＋ 4 倍音（すぐ消える）＋ 小さな当たり */
export function mallet(c: BaseAudioContext, out: AudioNode, at: number, hz: number, peak: number, dur: number): void {
  tone(c, out, at, hz, hz, peak, dur);
  tone(c, out, at, hz * 4, hz * 4, peak * 0.16, dur * 0.3, 0.001);
  knock(c, out, at, 1800, peak * 0.45, 0.006);
}
