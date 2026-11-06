// ファイルへの書き出し / 読み込み（JSON）。ブラウザのデータはドメインごとなので、
// バックアップや別の端末・別のアドレスへの移動に使う。

import { BASE_SIZE, MAX_FILE_BYTES } from './config';
import { exportJson, meta, newId, parseJson, pushUndo, tiles, type Tile } from './state';
import { byId, fileInput, importDlg } from './dom';
import { bounds, changed, removeTile, select, syncAll } from './tiles';
import { doUndo } from './toolbar';
import { showToast } from './toast';
import { fitAll } from './view';

const two = (n: number) => String(n).padStart(2, '0');

export function exportFile(): void {
  if (!tiles.size) {
    showToast('書き出す文字がありません');
    return;
  }
  const d = new Date();
  const name = `mojibara-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.json`;
  const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast(`${tiles.size} 文字を書き出しました`);
}

export function importFile(): void {
  fileInput.click();
}

/** いまの内容をすべて、読み込んだ文字に置き換える */
function replaceWith(list: Tile[]): void {
  pushUndo();
  for (const id of [...tiles.keys()]) removeTile(id);
  meta.zTop = 0;
  for (const t of [...list].sort((a, b) => a.z - b.z)) tiles.set(t.id, { ...t, z: ++meta.zTop });
  syncAll();
  select([]);
}

/** いまの内容の右隣に、読み込んだ文字を足す（新しい id を振り、重ならない位置へ） */
function addAfter(list: Tile[]): void {
  pushUndo();
  const now = bounds([...tiles.values()]);
  let minX = Infinity;
  let minY = Infinity;
  for (const t of list) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
  }
  const dx = now.x + now.w + BASE_SIZE * 2 - minX;
  const dy = now.y - minY;
  const ids: string[] = [];
  for (const t of [...list].sort((a, b) => a.z - b.z)) {
    const c: Tile = { ...t, id: newId(), x: t.x + dx, y: t.y + dy, z: ++meta.zTop };
    tiles.set(c.id, c);
    ids.push(c.id);
  }
  syncAll();
  select(ids);
}

function apply(list: Tile[], mode: 'replace' | 'add'): void {
  if (mode === 'replace') replaceWith(list);
  else addAfter(list);
  changed();
  fitAll();
  showToast(`${list.length} 文字を読み込みました`, { label: '元に戻す', run: doUndo });
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = ''; // 同じファイルをもう一度選べるように
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showToast('ファイルが大きすぎて読み込めません');
    return;
  }
  const list = parseJson(await file.text());
  if (!list) {
    showToast('読み込めませんでした。もじばらの JSON ではないか、文字が多すぎます');
    return;
  }
  if (!list.length) {
    showToast('ファイルに文字がありませんでした');
    return;
  }
  if (!tiles.size) {
    apply(list, 'replace');
    return;
  }
  // 文字があるときは、置き換えるか足すかを確かめる
  pending = list;
  byId('import-now').textContent = String(tiles.size);
  byId('import-new').textContent = String(list.length);
  importDlg.showModal();
});

let pending: Tile[] | null = null;

importDlg.addEventListener('close', () => {
  const list = pending;
  const mode = importDlg.returnValue;
  pending = null;
  importDlg.returnValue = '';
  if (list && (mode === 'replace' || mode === 'add')) apply(list, mode);
});
