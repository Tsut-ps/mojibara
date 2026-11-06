// DOM 要素の参照とアイコン

export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
}

export const stage = byId('stage');

export const world = byId('world');

export const marquee = byId('marquee');

export const editor = byId<HTMLTextAreaElement>('editor');

export const menu = byId('menu');

export const confirmDlg = byId<HTMLDialogElement>('confirm');

export const undoBtn = byId<HTMLButtonElement>('undo');

export const redoBtn = byId<HTMLButtonElement>('redo');

export const clearBtn = byId<HTMLButtonElement>('clear');

export const zoomLabel = byId('zoom-reset');

export const toastEl = byId('toast');

const ICONS: Record<string, string> = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  grow: '<path d="M3 19 8 6l5 13M5 14h6"/><path d="M19 4v6M16 7h6"/>',
  shrink: '<path d="M3 19 8 6l5 13M5 14h6"/><path d="M16 7h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1-1"/>',
  align:
    '<path d="M3 12h18"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="10.5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>',
  shuffle:
    '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',
  select: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
  type: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  volume:
    '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  'volume-off': '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>',
};

export function svg(name: string): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = svg(el.dataset.icon ?? '');
});
