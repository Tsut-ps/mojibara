// キーボードショートカット

import { COLORS, view } from './state';
import { confirmDlg } from './dom';
import { editSelected } from './editor';
import { closeMenu } from './menu';
import { setSpace } from './pointer';
import {
  deleteSelected,
  duplicateSelected,
  lineUpSelected,
  nudgeSelected,
  resizeSelected,
  scatterSelected,
  select,
  selectAll,
  selectConnected,
  selected,
  setColor,
} from './tiles';
import { doRedo, doUndo } from './toolbar';

// 矢印キー移動の 1 回の量（画面上の px）。Shift で大きく動かす
const NUDGE_PX = 1;
const NUDGE_BIG_PX = 10;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function isTyping(target: EventTarget | null): boolean {
  if (confirmDlg.open) return true;
  return target instanceof Element && !!target.closest('textarea, input, dialog');
}

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;
  const onButton = e.target instanceof HTMLButtonElement;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  if (e.code === 'Space' && !onButton) {
    e.preventDefault();
    setSpace(true);
  } else if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo();
    else doUndo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    doRedo();
  } else if (mod && key === 'a') {
    e.preventDefault();
    selectAll();
  } else if (mod && key === 'd') {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected.size) {
      e.preventDefault();
      deleteSelected();
    }
  } else if (e.key in ARROWS && selected.size && !mod && !e.altKey) {
    e.preventDefault();
    const [ax, ay] = ARROWS[e.key];
    const step = (e.shiftKey ? NUDGE_BIG_PX : NUDGE_PX) / view.s;
    nudgeSelected(ax * step, ay * step);
  } else if (selected.size && !mod && !e.altKey && !e.shiftKey && /^[1-8]$/.test(e.key)) {
    // 数字キーで色（メニューの色の並び順）
    setColor(COLORS[Number(e.key) - 1].key);
  } else if (selected.size && !mod && !e.altKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    resizeSelected(1.25);
  } else if (selected.size && !mod && !e.altKey && e.key === '-') {
    e.preventDefault();
    resizeSelected(0.8);
  } else if (key === 'w' && selected.size && !mod && !e.altKey && !e.shiftKey) {
    selectConnected();
  } else if (selected.size > 1 && !mod && !e.altKey && !e.shiftKey && (key === 'l' || key === 's')) {
    if (key === 'l') lineUpSelected();
    else scatterSelected();
  } else if (e.key === 'Escape') {
    closeMenu();
    if (selected.size) select([]);
  } else if (e.key === 'Enter' && !onButton && selected.size === 1) {
    e.preventDefault();
    closeMenu(); // 開いたままのメニューを閉じてから編集へ
    editSelected();
  }
});

const releaseSpace = () => setSpace(false);

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') releaseSpace();
});

window.addEventListener('blur', releaseSpace);
