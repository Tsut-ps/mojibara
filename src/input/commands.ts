// 操作の定義（名前・アイコン・ショートカット・実行を 1 か所に集約）
// キー入力（keys.ts）とメニュー（menus.ts）はここから組み立てる

import { MOD } from '../core/config';
import { COLORS, view } from '../core/state';
import { exportFile, importFile } from '../ui/data';
import { editSelected } from '../ui/editor';
import { closeMenu } from '../ui/menu';
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
} from '../tiles/tiles';
import { askDeleteAll, doRedo, doUndo } from '../ui/toolbar';
import { playSfx } from '../sound';
import { fitAll } from '../core/view';

// 修飾キーの条件。true=押している / false=押していない / 'any'=どちらでもよい
type Flag = boolean | 'any';

export interface Shortcut {
  key: string[]; // e.key（小文字）。複数あればどれでもよい
  mod?: Flag; // Ctrl / ⌘（既定: 押していない）
  shift?: Flag; // 既定: どちらでもよい
  alt?: Flag; // 既定: 押していない
  notOnButton?: boolean; // ボタンにフォーカス中は反応しない
}

export interface Command {
  id: string;
  label: string;
  icon?: string; // メニューに出すときのアイコン
  shortcut?: Shortcut | Shortcut[]; // 先頭がメニューのヒントになる
  when?: () => boolean; // 実行できる条件（キー・メニュー共通）
  danger?: boolean; // メニューで赤く表示
  keep?: boolean; // メニューを閉じずに実行する
  run: (e?: KeyboardEvent) => void; // e はキー操作のときだけ渡る
}

const some = () => selected.size > 0;
const one = () => selected.size === 1;
const many = () => selected.size > 1;

// 矢印キー移動の 1 回の量（画面上の px）。Shift で大きく動かす
const NUDGE_PX = 1;
const NUDGE_BIG_PX = 10;
const ARROWS: [string, number, number][] = [
  ['arrowleft', -1, 0],
  ['arrowright', 1, 0],
  ['arrowup', 0, -1],
  ['arrowdown', 0, 1],
];

export const commands = {
  undo: { id: 'undo', label: '元に戻す', shortcut: { key: ['z'], mod: true, shift: false }, run: doUndo },
  redo: {
    id: 'redo',
    label: 'やり直す',
    shortcut: [{ key: ['z'], mod: true, shift: true }, { key: ['y'], mod: true }],
    run: doRedo,
  },
  selectAll: { id: 'selectAll', label: 'すべて選択', icon: 'select', shortcut: { key: ['a'], mod: true }, run: selectAll },
  duplicate: { id: 'duplicate', label: '複製', icon: 'copy', shortcut: { key: ['d'], mod: true },
    when: some,
    run: () => {
      duplicateSelected();
      playSfx('duplicate');
    },
  },
  delete: {
    id: 'delete',
    label: '削除',
    icon: 'trash',
    shortcut: { key: ['delete', 'backspace'], mod: 'any', alt: 'any' },
    when: some,
    danger: true,
    run: () => {
      deleteSelected();
      playSfx('delete');
    },
  },
  grow: {
    id: 'grow',
    label: '大きく',
    icon: 'grow',
    shortcut: { key: ['+', '='] },
    when: some,
    keep: true,
    run: () => resizeSelected(1.25),
  },
  shrink: {
    id: 'shrink',
    label: '小さく',
    icon: 'shrink',
    shortcut: { key: ['-'] },
    when: some,
    keep: true,
    run: () => resizeSelected(0.8),
  },
  edit: {
    id: 'edit',
    label: '編集',
    icon: 'edit',
    shortcut: { key: ['enter'], mod: 'any', shift: 'any', alt: 'any', notOnButton: true },
    when: one,
    run: () => {
      closeMenu(); // 開いたままのメニューを閉じてから編集へ
      editSelected();
    },
  },
  connected: {
    id: 'connected',
    label: 'つながった文字も選択',
    icon: 'link',
    shortcut: { key: ['w'], shift: false },
    when: some,
    run: selectConnected,
  },
  lineUp: {
    id: 'lineUp',
    label: '一列に整列',
    icon: 'align',
    shortcut: { key: ['l'], shift: false },
    when: many,
    run: () => {
      lineUpSelected();
      playSfx('arrange');
    },
  },
  scatter: {
    id: 'scatter',
    label: 'ばらまく',
    icon: 'shuffle',
    shortcut: { key: ['s'], shift: false },
    when: many,
    run: () => {
      scatterSelected();
      playSfx('scatter');
    },
  },
  deselect: {
    id: 'deselect',
    label: '選択を解除',
    shortcut: { key: ['escape'], mod: 'any', shift: 'any', alt: 'any' },
    run: () => {
      closeMenu();
      if (selected.size) select([]);
    },
  },
  fit: { id: 'fit', label: '全体を表示', icon: 'fit', run: fitAll },
  clear: { id: 'clear', label: 'すべて削除', icon: 'trash', danger: true, run: askDeleteAll },
  export: { id: 'export', label: 'ファイルに書き出し（JSON）', icon: 'download', run: exportFile },
  import: { id: 'import', label: 'ファイルから読み込み（JSON）', icon: 'upload', run: importFile },
} satisfies Record<string, Command>;

// 数字キー 1〜8 で色（メニューの色の並び順）
export const colorCommands: Command[] = COLORS.map((c, i) => ({
  id: `color-${c.key}`,
  label: c.label,
  shortcut: { key: [String(i + 1)], shift: false },
  when: some,
  run: () => setColor(c.key),
}));

// 矢印キーで少し動かす（Shift で大きく）
const nudges: Command[] = ARROWS.map(([key, ax, ay]) => ({
  id: `nudge-${key}`,
  label: '少し動かす',
  shortcut: { key: [key] },
  when: some,
  run: (e) => {
    const step = (e?.shiftKey ? NUDGE_BIG_PX : NUDGE_PX) / view.s;
    nudgeSelected(ax * step, ay * step);
  },
}));

// キー入力の照合対象（優先順は先頭から）
export const keyCommands: Command[] = [...Object.values<Command>(commands), ...colorCommands, ...nudges];

const flagOk = (f: Flag | undefined, fallback: Flag, v: boolean) => (f ?? fallback) === 'any' || (f ?? fallback) === v;

export function matchShortcut(c: Command, e: KeyboardEvent): boolean {
  if (!c.shortcut) return false;
  const list = Array.isArray(c.shortcut) ? c.shortcut : [c.shortcut];
  const key = e.key.toLowerCase();
  const onButton = e.target instanceof HTMLButtonElement;
  return list.some(
    (s) =>
      s.key.includes(key) &&
      flagOk(s.mod, false, e.metaKey || e.ctrlKey) &&
      flagOk(s.shift, 'any', e.shiftKey) &&
      flagOk(s.alt, false, e.altKey) &&
      !(s.notOnButton && onButton),
  );
}

const HINT_NAMES: Record<string, string> = { delete: 'Del', enter: 'Enter' };

// メニューに添えるショートカット表記
export function hintOf(c: Command): string | undefined {
  const s = Array.isArray(c.shortcut) ? c.shortcut[0] : c.shortcut;
  if (!s) return undefined;
  const k = s.key[0];
  const name = HINT_NAMES[k] ?? (k.length === 1 ? k.toUpperCase() : k);
  return (s.mod === true ? MOD : '') + name;
}

// 実行できる状態か
export const canRun = (c: Command) => !c.when || c.when();
