// 右クリックメニュー

import { COLORS } from './state';
import { MOD } from './config';
import { menu, svg } from './dom';
import { editSelected, openNew } from './editor';
import {
  deleteSelected,
  duplicateSelected,
  resizeSelected,
  selectAll,
  selectConnected,
  selectedTiles,
  setColor,
} from './tiles';
import { askDeleteAll } from './toolbar';
import { clamp } from './util';
import { fitAll } from './view';

type MenuEntry =
  | { type: 'item'; label: string; icon: string; hint?: string; danger?: boolean; keep?: boolean; run: () => void }
  | { type: 'sep' }
  | { type: 'caption'; text: string }
  | { type: 'colors'; current: string | null };

function showMenu(x: number, y: number, entries: MenuEntry[]): void {
  menu.replaceChildren();
  for (const en of entries) {
    if (en.type === 'sep') {
      const d = document.createElement('div');
      d.className = 'msep';
      menu.appendChild(d);
    } else if (en.type === 'caption') {
      const d = document.createElement('div');
      d.className = 'mcap';
      d.textContent = en.text;
      menu.appendChild(d);
    } else if (en.type === 'colors') {
      const row = document.createElement('div');
      row.className = 'swatches';
      COLORS.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'sw' + (en.current === c.key ? ' current' : '');
        b.style.setProperty('--c', `var(--c-${c.key})`);
        b.title = `${c.label}（${i + 1}）`;
        b.setAttribute('aria-label', c.label);
        b.addEventListener('click', () => {
          closeMenu();
          setColor(c.key);
        });
        row.appendChild(b);
      });
      menu.appendChild(row);
    } else {
      const b = document.createElement('button');
      b.className = 'mi' + (en.danger ? ' danger' : '');
      b.setAttribute('role', 'menuitem');
      b.innerHTML = `${svg(en.icon)}<span></span>${en.hint ? '<span class="hint"></span>' : ''}`;
      const spans = b.querySelectorAll('span');
      spans[0].textContent = en.label;
      if (en.hint && spans[1]) spans[1].textContent = en.hint;
      b.addEventListener('click', () => {
        if (!en.keep) closeMenu();
        en.run();
      });
      menu.appendChild(b);
    }
  }
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${clamp(x, 8, window.innerWidth - r.width - 8)}px`;
  menu.style.top = `${clamp(y, 8, window.innerHeight - r.height - 8)}px`;
}

export function closeMenu(): void {
  menu.hidden = true;
}

export function showTileMenu(x: number, y: number): void {
  const list = selectedTiles();
  const n = list.length;
  const colors = new Set(list.map((t) => t.color));
  const entries: MenuEntry[] = [];
  if (n > 1) entries.push({ type: 'caption', text: `${n}文字を選択中` });
  entries.push({ type: 'colors', current: colors.size === 1 ? [...colors][0] : null });
  entries.push({ type: 'sep' });
  entries.push({ type: 'item', label: '大きく', icon: 'grow', hint: '+', keep: true, run: () => resizeSelected(1.25) });
  entries.push({ type: 'item', label: '小さく', icon: 'shrink', hint: '-', keep: true, run: () => resizeSelected(0.8) });
  if (n === 1) entries.push({ type: 'item', label: '編集', icon: 'edit', hint: 'Enter', run: editSelected });
  entries.push({ type: 'item', label: 'つながった文字も選択', icon: 'link', hint: 'W', run: selectConnected });
  entries.push({ type: 'item', label: '複製', icon: 'copy', hint: `${MOD}D`, run: duplicateSelected });
  entries.push({ type: 'sep' });
  entries.push({ type: 'item', label: '削除', icon: 'trash', hint: 'Del', danger: true, run: deleteSelected });
  showMenu(x, y, entries);
}

export function showBgMenu(x: number, y: number): void {
  showMenu(x, y, [
    { type: 'item', label: 'ここに入力', icon: 'type', run: () => setTimeout(() => openNew(x, y), 0) },
    { type: 'item', label: 'すべて選択', icon: 'select', hint: `${MOD}A`, run: selectAll },
    { type: 'item', label: '全体を表示', icon: 'fit', run: fitAll },
    { type: 'sep' },
    { type: 'item', label: 'すべて削除', icon: 'trash', danger: true, run: askDeleteAll },
  ]);
}

// 外側を押したらメニューを閉じる
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node)) closeMenu();
  },
  true,
);
