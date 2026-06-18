<script setup lang="ts">
import type { MilestoneEvent } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

defineProps<{
  month: number
  events: MilestoneEvent[]
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
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ formatMonth(month) }} 专项</div>
    <div
      v-for="event in events"
      :key="event.id"
      class="flex items-baseline justify-between gap-4 text-ink-2"
    >
      <span class="truncate">{{ event.name }}</span>
      <span class="tabular-nums whitespace-nowrap" :class="{ italic: event.amount < 0 }">
        {{ formatCurrency(event.amount) }}
      </span>
    </div>
    <!-- 合计分隔线用柔和描边 -->
    <div class="mt-1 flex items-baseline justify-between gap-4 border-t border-line-soft pt-1 font-semibold">
      <span>净额</span>
      <span class="tabular-nums" :class="{ italic: net < 0 }">{{ formatCurrency(net) }}</span>
    </div>
  </div>
</template>
