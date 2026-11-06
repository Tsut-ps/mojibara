// メニューの描画（中身は menus.ts が commands から組み立てる）

import { COLORS } from './state';
import { menu, svg } from './dom';
import { clamp } from './util';

export type MenuEntry =
  | { type: 'item'; label: string; icon: string; hint?: string; danger?: boolean; keep?: boolean; run: () => void }
  | { type: 'sep' }
  | { type: 'caption'; text: string }
  | { type: 'colors'; current: string | null; titles: string[]; pick: (key: string) => void };

export function showMenu(x: number, y: number, entries: MenuEntry[]): void {
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
        b.title = en.titles[i];
        b.setAttribute('aria-label', c.label);
        b.addEventListener('click', () => {
          closeMenu();
          en.pick(c.key);
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

// 外側を押したらメニューを閉じる
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node)) closeMenu();
  },
  true,
);
