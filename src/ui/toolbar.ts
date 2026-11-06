// ツールバー・確認ダイアログ・ボタン表示の同期

import { canRedo, canUndo, flushSave, redo, tiles, undo, view } from '../core/state';
import { byId, clearBtn, confirmDlg, redoBtn, svg, undoBtn, zoomLabel } from '../core/dom';
import { isEditing, positionEditor } from './editor';
import { isSoundOn, playSfx, playSnap, setSoundOn } from '../sound';
import { showToast } from './toast';
import { changed, onChange, syncAll } from '../tiles/tiles';
import { deleteAll } from '../tiles/actions';
import { fitAll, tweenTo, zoomTarget } from '../core/view';

export function syncUi(): void {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();
  clearBtn.disabled = tiles.size === 0;
  document.body.classList.toggle('is-empty', tiles.size === 0 && !isEditing());
}

export function doUndo(): void {
  if (isEditing()) return;
  if (undo()) {
    syncAll();
    changed();
    playSfx('undo');
  }
}

export function doRedo(): void {
  if (isEditing()) return;
  if (redo()) {
    syncAll();
    changed();
    playSfx('redo');
  }
}

export function askDeleteAll(): void {
  if (!tiles.size) return;
  byId('confirm-count').textContent = String(tiles.size);
  confirmDlg.showModal();
}

confirmDlg.addEventListener('close', () => {
  if (confirmDlg.returnValue === 'ok') {
    deleteAll();
    playSfx('clear');
    showToast('すべて削除しました', { label: '元に戻す', run: doUndo });
  }
  confirmDlg.returnValue = '';
});

undoBtn.addEventListener('click', doUndo);

redoBtn.addEventListener('click', doRedo);

clearBtn.addEventListener('click', askDeleteAll);

byId('zoom-in').addEventListener('click', () =>
  tweenTo(zoomTarget(1.25, window.innerWidth / 2, window.innerHeight / 2)),
);

byId('zoom-out').addEventListener('click', () =>
  tweenTo(zoomTarget(0.8, window.innerWidth / 2, window.innerHeight / 2)),
);

zoomLabel.addEventListener('click', () =>
  tweenTo(zoomTarget(1 / view.s, window.innerWidth / 2, window.innerHeight / 2)),
);

byId('fit').addEventListener('click', fitAll);

// 効果音のオン/オフ（設定はこのブラウザに保存）
const soundBtn = byId<HTMLButtonElement>('sound');

function renderSound(): void {
  const on = isSoundOn();
  soundBtn.innerHTML = svg(on ? 'volume' : 'volume-off');
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.title = on ? '効果音: オン（クリックでオフ）' : '効果音: オフ（クリックでオン）';
}

soundBtn.addEventListener('click', () => {
  setSoundOn(!isSoundOn());
  renderSound();
  if (isSoundOn()) setTimeout(playSnap, 50); // オンにした合図に 1 回鳴らす
});

renderSound();

window.addEventListener('resize', positionEditor);

window.addEventListener('pagehide', flushSave);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

onChange(syncUi);
