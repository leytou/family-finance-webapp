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
    class="fixed z-50 min-w-48 max-w-96 border rounded bg-white p-3 text-sm shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(month) }} 专项</div>
    <div
      v-for="event in events"
      :key="event.id"
      class="flex items-baseline justify-between gap-4 text-gray-700"
    >
      <span class="truncate">{{ event.name }}</span>
      <span class="tabular-nums whitespace-nowrap" :class="{ italic: event.amount < 0 }">
        {{ formatCurrency(event.amount) }}
      </span>
    </div>
    <div class="mt-1 flex items-baseline justify-between gap-4 border-t pt-1 font-semibold">
      <span>净额</span>
      <span class="tabular-nums" :class="{ italic: net < 0 }">{{ formatCurrency(net) }}</span>
    </div>
  </div>
</template>
