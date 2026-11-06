// 効果音のレシピ（スナップ音と、操作ごとの音）。素材は parts.ts

import { A4, C3, C4, D4, E4, G4, knock, mallet, swish, thud, tone } from './parts';

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
export const SFX: Record<Sfx, { trim: number; play: (c: BaseAudioContext, out: AudioNode, t: number) => void }> = {
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
