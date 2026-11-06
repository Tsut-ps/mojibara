// 文字（タイル）のドラッグ移動・タップ・ダブルタップ編集

import { pushUndo, tiles, view } from '../../core/state';
import { DRAG_PX, LIFT_MAX, SNAP_PX } from '../../core/config';
import { stage } from '../../core/dom';
import { openEdit } from '../../ui/editor';
import { findSnap, type Rect, type Snap, type Target } from '../../tiles/snap';
import { playSnap } from '../../sound';
import {
  bounds,
  bringToFront,
  changed,
  connectedOf,
  els,
  refreshSelection,
  select,
  selected,
  selectedTiles,
  worldRect,
} from '../../tiles/tiles';
import { type Gesture, cancelLongPress } from './shared';

let lastTap: { id: string; t: number; x: number; y: number } | null = null;

/**
 * 文字を押した。additive: Shift・Ctrl/⌘ ＝ クリックは 1 つずつ追加 / 外す、
 * ドラッグはつながった文字ごと動かす。
 */
export function startTilesDrag(e: PointerEvent, id: string, additive: boolean): Gesture {
  const startX = e.clientX;
  const startY = e.clientY;
  const wasSelected = selected.has(id);
  if (additive) {
    if (!wasSelected) {
      selected.add(id);
      refreshSelection();
    }
  } else if (!wasSelected) {
    select([id]);
  }
  const orig = new Map<string, { x: number; y: number }>();
  for (const t of selectedTiles()) orig.set(t.id, { x: t.x, y: t.y });

  let moved = false;
  // 横スナップ用（動かし始めた時点で確定する）
  let group: Rect | null = null; // 動かしている文字の範囲
  let others: Target[] = []; // 吸着先の候補（動かさない文字）
  let moving: HTMLElement[] = [];
  let snap: Snap | null = null; // 今の吸着状態
  let evaluated = false; // 吸着の判定を一度でも行ったか（最初の判定は音を鳴らさない）
  let glideTimer = 0;

  /**
   * 吸着先が変わった：ぬるっと動かし、吸着していない状態から吸着したときだけカチッと鳴らす。
   * silent は、持ち上げた時点ですでに隣にくっついていた場合（持ち上げただけで鳴らさない）。
   */
  function setSnap(next: Snap | null, silent: boolean): void {
    const engaging = !snap && next !== null; // 吸着先どうしの乗り換えでは鳴らさない
    if (snap) els.get(snap.id)?.classList.remove('snap-target');
    snap = next;
    for (const el of moving) el.classList.add('glide');
    window.clearTimeout(glideTimer);
    glideTimer = window.setTimeout(() => {
      for (const el of moving) el.classList.remove('glide');
    }, 160);
    if (next) els.get(next.id)?.classList.add('snap-target');
    if (engaging && !silent) playSnap();
  }

  /** 終わる・中断したとき、持ち上げ表示と吸着先の表示を消す */
  function cleanup(): void {
    for (const el of moving) el.classList.remove('lifted');
    if (snap) {
      els.get(snap.id)?.classList.remove('snap-target');
      snap = null;
    }
  }

  return {
    get longPressable() {
      return !moved;
    },
    move(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        moved = true;
        cancelLongPress();
        pushUndo();
        if (additive) {
          // Shift・Ctrl/⌘ で動かし始めたら、押した文字につながった文字も選択に加えて、いっしょに動かす
          for (const g of connectedOf([id])) {
            selected.add(g);
            const t = tiles.get(g);
            if (t && !orig.has(g)) orig.set(g, { x: t.x, y: t.y });
          }
          refreshSelection();
        }
        const list = selectedTiles();
        bringToFront(list);
        for (const t of list) els.get(t.id)?.classList.remove('spawn');
        stage.classList.add('dragging');
        // 横スナップの準備：動かす範囲と、動かさない文字の位置を一度だけ測る
        group = bounds(list);
        others = [...tiles.values()].filter((t) => !orig.has(t.id)).map((t) => ({ id: t.id, ...worldRect(t) }));
        moving = list.map((t) => els.get(t.id)).filter((el): el is HTMLDivElement => !!el);
        // 掴んだ文字を持ち上げて見せる（大量だと重くなるので少数のときだけ）
        if (moving.length <= LIFT_MAX) for (const el of moving) el.classList.add('lifted');
      }

      // 横スナップ（Alt を押している間は無効）
      let sx = 0;
      let sy = 0;
      if (group) {
        const raw = { x: group.x + dx / view.s, y: group.y + dy / view.s, w: group.w, h: group.h };
        const found = e.altKey ? null : findSnap(raw, others, SNAP_PX / view.s, snap);
        const first = !evaluated;
        evaluated = true;
        if (found?.id !== snap?.id || found?.side !== snap?.side) setSnap(found, first);
        sx = found?.dx ?? 0;
        sy = found?.dy ?? 0;
      }

      for (const [tid, o] of orig) {
        const t = tiles.get(tid);
        const el = els.get(tid);
        if (!t || !el) continue;
        t.x = o.x + dx / view.s + sx;
        t.y = o.y + dy / view.s + sy;
        el.style.translate = `${t.x}px ${t.y}px`;
      }
      changed();
    },
    end(e, ok) {
      cleanup();
      if (moved || !ok) return;
      // ここからは「動かさずに離した」＝タップ
      if (additive) {
        // すでに選んでいた文字なら外す（1 つずつ追加・外す）
        if (wasSelected) {
          selected.delete(id);
          refreshSelection();
        }
        return;
      }
      if (selected.size > 1) select([id]);
      const now = performance.now();
      if (
        lastTap &&
        lastTap.id === id &&
        now - lastTap.t < 400 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 10
      ) {
        lastTap = null;
        setTimeout(() => {
          select([id]);
          openEdit(id);
        }, 0);
      } else {
        lastTap = { id, t: now, x: e.clientX, y: e.clientY };
      }
    },
    abort: cleanup,
  };
}
