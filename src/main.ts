// 起動（初期化と各モジュールの読み込み）

import './style.css';
import { load, meta, view } from './core/state';
import { syncAll } from './tiles/tiles';
import { syncUi } from './ui/toolbar';
import { applyView } from './core/view';
import './ui/editor';
import './input/pointer';
import './input/wheel';
import './input/keys';
import './ui/clipboard';

load();

if (!meta.hasSavedView) {
  view.x = window.innerWidth / 2;
  view.y = window.innerHeight / 2;
  view.s = 1;
}

syncAll();

applyView();

syncUi();
