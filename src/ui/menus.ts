// 右クリックメニューなどの中身（commands から組み立てる）

import { COLORS } from '../core/state';
import { byId } from '../core/dom';
import { type Command, colorCommands, canRun, commands, hintOf } from '../input/commands';
import { openNew } from './editor';
import { type MenuEntry, showMenu } from './menu';
import { selectedTiles } from '../tiles/tiles';

const item = (c: Command): MenuEntry => ({
  type: 'item',
  label: c.label,
  icon: c.icon ?? '',
  hint: hintOf(c),
  danger: c.danger,
  keep: c.keep,
  run: () => c.run(),
});

// 実行できるものだけをメニュー項目にする
const items = (list: Command[]): MenuEntry[] => list.filter(canRun).map(item);

export function showTileMenu(x: number, y: number): void {
  const list = selectedTiles();
  const n = list.length;
  const colors = new Set(list.map((t) => t.color));
  const c = commands;
  const entries: MenuEntry[] = [];
  if (n > 1) entries.push({ type: 'caption', text: `${n}文字を選択中` });
  entries.push({
    type: 'colors',
    current: colors.size === 1 ? [...colors][0] : null,
    titles: colorCommands.map((cc, i) => `${COLORS[i].label}（${hintOf(cc)}）`),
    pick: (key) => colorCommands.find((cc) => cc.id === `color-${key}`)?.run(),
  });
  entries.push({ type: 'sep' });
  entries.push(...items([c.grow, c.shrink, c.edit, c.lineUp, c.scatter, c.connected, c.duplicate]));
  entries.push({ type: 'sep' });
  entries.push(...items([c.delete]));
  showMenu(x, y, entries);
}

export function showBgMenu(x: number, y: number): void {
  const c = commands;
  showMenu(x, y, [
    { type: 'item', label: 'ここに入力', icon: 'type', run: () => setTimeout(() => openNew(x, y), 0) },
    ...items([c.selectAll, c.fit]),
    { type: 'sep' },
    ...items([c.clear]),
  ]);
}

// 右上のボタン：ファイルへの書き出し / 読み込み
byId('data').addEventListener('click', (e) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  showMenu(r.right, r.bottom + 6, items([commands.export, commands.import]));
});
