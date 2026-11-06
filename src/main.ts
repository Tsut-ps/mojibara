// 起動（初期化と各モジュールの読み込み）

import './style.css';
import { load, meta, view } from './state';
import { syncAll } from './tiles';
import { syncUi } from './toolbar';
import { applyView } from './view';
import './editor';
import './pointer';
import './keys';
import './clipboard';

load();

if (!meta.hasSavedView) {
  view.x = window.innerWidth / 2;
  view.y = window.innerHeight / 2;
  view.s = 1;
}

syncAll();

applyView();

syncUi();
