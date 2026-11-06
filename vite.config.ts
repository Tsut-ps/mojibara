import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// JS/CSS を index.html に埋め込んで 1 ファイルにする（置くだけで動く）
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
