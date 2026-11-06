// キーボードショートカット（定義は commands.ts）

import { confirmDlg } from '../core/dom';
import { keyCommands, matchShortcut } from './commands';
import { setSpace } from './pointer';

function isTyping(target: EventTarget | null): boolean {
  if (confirmDlg.open) return true;
  return target instanceof Element && !!target.closest('textarea, input, dialog');
}

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;
  const onButton = e.target instanceof HTMLButtonElement;

  // Space を押している間は手のひらツール
  if (e.code === 'Space' && !onButton) {
    e.preventDefault();
    setSpace(true);
    return;
  }

  const cmd = keyCommands.find((c) => matchShortcut(c, e) && (!c.when || c.when()));
  if (!cmd) return;
  e.preventDefault();
  cmd.run(e);
});

const releaseSpace = () => setSpace(false);

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') releaseSpace();
});

window.addEventListener('blur', releaseSpace);
