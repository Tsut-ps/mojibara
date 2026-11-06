// キーボードショートカット

import { confirmDlg } from './dom';
import { editSelected } from './editor';
import { closeMenu } from './menu';
import { setSpace } from './pointer';
import { deleteSelected, duplicateSelected, select, selectAll, selected } from './tiles';
import { doRedo, doUndo } from './toolbar';

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
