// 画面下の小さな通知（「元に戻す」などの操作つき）

import { undoDepth } from '../core/state';
import { toastEl } from '../core/dom';
import { onChange } from '../tiles/tiles';

let timer = 0;
let depth = -1; // 操作つきのとき、表示した時点の履歴の深さ

export function hideToast(): void {
  window.clearTimeout(timer);
  toastEl.hidden = true;
  depth = -1;
}

export function showToast(message: string, action?: { label: string; run: () => void }, ms = 6000): void {
  window.clearTimeout(timer);
  const text = document.createElement('span');
  text.textContent = message;
  toastEl.replaceChildren(text);
  depth = -1;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-btn';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      hideToast();
      action.run();
    });
    toastEl.append(b);
    depth = undoDepth();
  }
  toastEl.hidden = false;
  timer = window.setTimeout(hideToast, ms);
}

// 別の操作で履歴が進んだら、取り消しボタンは古くなるので閉じる
onChange(() => {
  if (depth >= 0 && undoDepth() !== depth) hideToast();
});
