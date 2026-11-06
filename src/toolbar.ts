// ツールバー・確認ダイアログ・ボタン表示の同期

import { canRedo, canUndo, flushSave, redo, tiles, undo, view } from './state';
import { byId, clearBtn, confirmDlg, redoBtn, undoBtn, zoomLabel } from './dom';
import { isEditing, positionEditor } from './editor';
import { changed, deleteAll, onChange, syncAll } from './tiles';
import { fitAll, tweenTo, zoomTarget } from './view';

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
  }
}

export function doRedo(): void {
  if (isEditing()) return;
  if (redo()) {
    syncAll();
    changed();
  }
}

export function askDeleteAll(): void {
  if (!tiles.size) return;
  byId('confirm-count').textContent = String(tiles.size);
  confirmDlg.showModal();
}

confirmDlg.addEventListener('close', () => {
  if (confirmDlg.returnValue === 'ok') deleteAll();
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

window.addEventListener('resize', positionEditor);

window.addEventListener('pagehide', flushSave);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

onChange(syncUi);
