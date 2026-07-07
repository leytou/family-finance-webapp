<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  title: string
  index?: string
  icon?: string
  sticky?: boolean
}>(), {
  sticky: false,
})

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

function toggle() {
  emit('update:collapsed', !props.collapsed)
}

// 标题图标库：线性（stroke）风格，currentColor 上色，统一 24×24 viewBox。
// 路径取自 Lucide（ISC 许可），贴合现有的「金融终端」极简等宽美学。
const ICON_SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const ICONS: Record<string, string> = {
  // 参数 —— 滑块调钮
  sliders: `<svg ${ICON_SVG_ATTRS}><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>`,
  // 指标 —— 半圆仪表盘
  gauge: `<svg ${ICON_SVG_ATTRS}><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
  // 年度汇总 —— 日历
  calendar: `<svg ${ICON_SVG_ATTRS}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>`,
  // 月度流水 —— 清单（带横行）
  list: `<svg ${ICON_SVG_ATTRS}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
}

const iconSvg = computed(() => (props.icon ? ICONS[props.icon] : ''))
</script>

<template>
  <div>
    <!-- 折叠头：四个区块复用，统一为「箭头 + 图标 + 标题」 -->
    <!-- 外层行容器：承担整行外观与钉顶/分隔，不响应点击，避免整行成为热区 -->
    <div
      data-testid="collapse-header-row"
      class="px-4 py-1.5 flex items-center bg-surface"
      :class="{ 'sticky top-0 z-1': sticky }"
    >
      <button
        type="button"
        data-testid="collapse-header"
        class="inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 rounded px-1.5 py-0.5 hover:bg-surface-2 cursor-pointer"
        :aria-expanded="!collapsed"
        @click="toggle"
      >
        <span data-testid="collapse-arrow" aria-hidden="true">{{ collapsed ? '▸' : '▾' }}</span>
        <span v-if="index" data-testid="collapse-index" class="text-brand-600 font-bold">{{ index }}</span>
        <span
          v-if="iconSvg"
          v-html="iconSvg"
          data-testid="collapse-icon"
          class="inline-flex items-center shrink-0 text-brand-600"
          aria-hidden="true"
        />
        {{ title }}
      </button>
    </div>
    <!-- v-show 保留 DOM：避免展开后输入框重新挂载导致失焦/丢值 -->
    <div v-show="!collapsed" data-testid="collapse-content">
      <slot />
    </div>
  </div>
</template>
