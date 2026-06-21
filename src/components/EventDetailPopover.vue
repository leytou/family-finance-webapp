<script setup lang="ts">
import { formatCurrency } from '../utils/format'

// 通用只读明细弹窗：专项与动态列明细悬停均复用本组件。
// 结构与 ItemEditor 的 items 同构：{ name, amount }[] + net。
defineProps<{
  title: string
  items: { name: string; amount: number }[]
  net: number
  x: number
  y: number
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    class="fixed z-50 min-w-48 max-w-96 rounded-xl border border-line bg-surface p-3 text-sm text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <!-- 统一浮层标题样式（等宽小号大写） -->
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ title }}</div>
    <div
      v-for="(item, index) in items"
      :key="index"
      class="flex items-baseline justify-between gap-4 text-ink-2"
    >
      <span class="truncate">{{ item.name }}</span>
      <span class="tabular-nums whitespace-nowrap" :class="{ italic: item.amount < 0 }">
        {{ formatCurrency(item.amount) }}
      </span>
    </div>
    <!-- 合计分隔线用柔和描边 -->
    <div class="mt-1 flex items-baseline justify-between gap-4 border-t border-line-soft pt-1 font-semibold">
      <span>净额</span>
      <span class="tabular-nums" :class="{ italic: net < 0 }">{{ formatCurrency(net) }}</span>
    </div>
  </div>
</template>
