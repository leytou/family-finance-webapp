/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [vue(), UnoCSS(), viteSingleFile()],
  // 打包成单个 .html 文件：所有 JS/CSS 都内联进 index.html，
  // 朋友双击打开即可使用，规避 Chrome 内核浏览器在本地文件下的安全限制。
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
})
