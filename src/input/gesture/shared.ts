// ポインタ操作（ジェスチャ）の共通部分

/** 1 つのドラッグ操作。pointer.ts が押した場所に応じて 1 つ作り、イベントを渡す */
export interface Gesture {
  move(e: PointerEvent): void;
  /** 指を離した（ok=true）/ 中断された（ok=false）。ここで後片付けも行う */
  end(e: PointerEvent, ok: boolean): void;
  /** 別の操作に切り替わる・メニューが開くなど、途中で打ち切るときの後片付け */
  abort(): void;
  /** まだ動かしていない（長押しでメニューを開いてよい） */
  readonly longPressable: boolean;
  /** 複数の指にまたがる操作（指が 1 本になるまで続く） */
  readonly multi?: boolean;
}

/** いま画面に触れているポインタの位置 */
export const pointers = new Map<number, { x: number; y: number }>();

/** 選択のない背景をタップした → click で入力欄を開く（iOS でキーボードを出すため） */
export const tap = { pending: false };

let lpTimer = 0;

export function startLongPress(fn: () => void, ms = 550): void {
  lpTimer = window.setTimeout(fn, ms);
}

export function cancelLongPress(): void {
  window.clearTimeout(lpTimer);
}
