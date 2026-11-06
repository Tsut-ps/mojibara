// 汎用の小さな関数（数値・文字の分割・フォント計測）

import { FONT, WEIGHT } from './config';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

export function graphemes(s: string): string[] {
  return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
}

const mctx = document.createElement('canvas').getContext('2d');

export function measure(text: string, px: number): number {
  if (!mctx) return text.length * px;
  mctx.font = `${WEIGHT} ${px}px ${FONT}`;
  return mctx.measureText(text).width;
}

/** 使う文字のフォントを先に読み込む（オフラインなどで待ち続けないよう上限付き） */
export async function ensureFont(text: string): Promise<void> {
  try {
    await Promise.race([document.fonts.load(`${WEIGHT} 36px ${FONT}`, text), sleep(600)]);
  } catch {
    /* フォールバックフォントのまま続行 */
  }
}
