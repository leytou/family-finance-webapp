import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './styles/theme.css'   // 全局样式基底（浅色金融终端）：字体变量、底色、滚动条
import 'driver.js/dist/driver.css'   // driver.js 基础样式
import './styles/tour.css'            // 项目气泡样式覆盖
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
