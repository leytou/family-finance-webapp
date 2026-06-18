import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './styles/theme.css'   // 全局样式基底（浅色金融终端）：字体变量、底色、滚动条
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
